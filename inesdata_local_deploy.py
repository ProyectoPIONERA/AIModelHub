#!/usr/bin/env python3
"""
Local deployment entrypoint for AIModelHub Pionera.

This script deploys INESData services using local images built from:
adapters/inesdata/sources
"""

import argparse
import glob
import json
import os
import shlex
import shutil
import socket
import subprocess
import sys
import time
import requests

from runtime_dependencies import ensure_runtime_dependencies


ensure_runtime_dependencies(
    requirements_path=os.path.join(os.path.dirname(__file__), "requirements.txt"),
    module_names=("yaml", "requests", "tabulate", "ruamel.yaml"),
    label="local INESData entrypoint",
)

import yaml

from adapters.inesdata import InesdataAdapter


DEFAULT_DOCKER_HUB_MIRRORS = (
    "mirror.gcr.io",
    "public.ecr.aws/docker",
)
COMBINED_HTTP_MODEL_MAX = 15

CANONICAL_STEP1_MANIFEST_NAME = "images-fast-step1.tsv"
PERSISTENT_MANIFEST_SUBDIR = os.path.join(".inesdata-local", "manifests")
MANIFEST_HEADER = "component\trepo_dir\timage\ttag\tfull_image\tbuild_cmd"
COMPONENT_IMAGE_NAME_BY_KEY = {
    "connector": "inesdata-connector",
    "connector-interface": "inesdata-connector-interface",
    "registration-service": "inesdata-registration-service",
    "public-portal-backend": "inesdata-public-portal-backend",
    "public-portal-frontend": "inesdata-public-portal-frontend",
}
COMPONENT_SOURCE_SUBDIR_BY_KEY = {
    "connector": os.path.join("adapters", "inesdata", "sources", "inesdata-connector"),
    "connector-interface": os.path.join("adapters", "inesdata", "sources", "inesdata-connector-interface"),
    "registration-service": os.path.join("adapters", "inesdata", "sources", "inesdata-registration-service"),
    "public-portal-backend": os.path.join("adapters", "inesdata", "sources", "inesdata-public-portal-backend"),
    "public-portal-frontend": os.path.join("adapters", "inesdata", "sources", "inesdata-public-portal-frontend"),
}
COMPONENT_KEY_BY_IMAGE_NAME = {
    image_name: component
    for component, image_name in COMPONENT_IMAGE_NAME_BY_KEY.items()
}
WINDOWS_ZONE_IDENTIFIER_SUFFIX = ":Zone.Identifier"
WINDOWS_ZONE_IDENTIFIER_SKIP_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
}


def _is_retryable_command(cmd: str) -> bool:
    non_retryable_scripts = (
        "local_build_load_deploy.sh",
        "build_images.sh",
        "fast_step1_images.sh",
    )
    if any(script in cmd for script in non_retryable_scripts):
        return False
    if "docker image inspect" in cmd:
        return False
    markers = ("docker", "minikube", "kubectl", "helm")
    return any(marker in cmd for marker in markers)


def run(cmd, capture=False, silent=False, check=True, cwd=None):
    """Execute shell command with simple retry logic for infra commands."""
    attempts = 3 if _is_retryable_command(cmd) else 1
    delay_seconds = 4
    is_portforward_pkill = (
        cmd.strip().startswith("pkill -f 'kubectl port-forward")
        or cmd.strip().startswith('pkill -f "kubectl port-forward')
    )

    for attempt in range(1, attempts + 1):
        if not silent:
            if attempts > 1:
                print(f"\nExecuting (attempt {attempt}/{attempts}): {cmd}")
            else:
                print(f"\nExecuting: {cmd}")

        try:
            result = subprocess.run(
                cmd,
                shell=True,
                text=True,
                capture_output=capture,
                cwd=cwd,
            )
        except Exception as exc:
            if attempt == attempts:
                print(f"Execution error: {exc}")
                return None
            print(f"Transient execution error: {exc}. Retrying in {delay_seconds}s...")
            time.sleep(delay_seconds)
            continue

        if result.returncode == 0:
            if capture:
                return result.stdout.strip()
            return result

        # pkill may return 1 (no process) or be terminated with SIGTERM (-15)
        # when matching short-lived/killed shells. Treat these outcomes as benign.
        if is_portforward_pkill and result.returncode in (1, -15):
            if capture:
                return result.stdout.strip() if result.stdout else ""
            return result

        stderr_text = result.stderr.strip() if result.stderr else ""
        stdout_text = result.stdout.strip() if result.stdout else ""
        combined = f"{stdout_text}\n{stderr_text}".strip()

        if attempt < attempts:
            if not silent and combined:
                print(combined)
            print(f"Command failed with exit code {result.returncode}. Retrying in {delay_seconds}s...")
            time.sleep(delay_seconds)
            continue

        if check:
            print(f"Command failed with exit code {result.returncode}")
            if combined:
                print(combined)
        return None

    return None


def run_silent(cmd, cwd=None):
    return run(cmd, capture=True, silent=True, check=False, cwd=cwd)


def project_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))


def default_use_case_model_server_dir() -> str:
    configured_dir = os.environ.get("USE_CASE_MODEL_SERVER_DIR") or os.environ.get("USE_CASE_SERVER_DIR")
    if configured_dir:
        return os.path.abspath(os.path.expanduser(configured_dir))

    candidate_dirs = [
        os.path.join(project_dir(), "AIModelHub-Use-Cases"),
        os.path.join(project_dir(), "AIModelHub_Use_Cases"),
        os.path.join(project_dir(), "AIModelHub_Uses_Cases"),
        os.path.join(os.path.dirname(project_dir()), "AIModelHub-Use-Cases"),
        os.path.join(os.path.dirname(project_dir()), "AIModelHub_Use_Cases"),
        os.path.join(os.path.dirname(project_dir()), "AIModelHub_Uses_Cases"),
    ]
    for candidate_dir in candidate_dirs:
        if os.path.exists(os.path.join(candidate_dir, "src", "server.py")):
            return os.path.abspath(candidate_dir)

    return os.path.abspath(candidate_dirs[-1])


def _use_case_python_candidates(server_dir: str):
    return [
        os.path.join(server_dir, ".venv", "bin", "python"),
        os.path.join(project_dir(), ".venv", "bin", "python"),
        os.path.join(os.path.dirname(project_dir()), ".venv", "bin", "python"),
        sys.executable,
    ]


def cleanup_windows_zone_identifier_files(args=None):
    """Remove Windows download metadata files that Helm may parse as YAML."""
    cleanup_roots = []
    default_platform_dir = os.path.join(project_dir(), "inesdata-deployment")

    if args is not None:
        try:
            cleanup_roots.append(resolve_platform_dir(args.platform_dir))
        except Exception:
            cleanup_roots.append(default_platform_dir)
    else:
        cleanup_roots.append(default_platform_dir)

    removed = 0
    failures = []
    seen_roots = set()

    for root in cleanup_roots:
        if not root:
            continue
        abs_root = os.path.abspath(root)
        if abs_root in seen_roots or not os.path.isdir(abs_root):
            continue
        seen_roots.add(abs_root)

        for current_dir, dirnames, filenames in os.walk(abs_root):
            dirnames[:] = [
                dirname
                for dirname in dirnames
                if dirname not in WINDOWS_ZONE_IDENTIFIER_SKIP_DIRS
            ]

            for filename in filenames:
                if not filename.endswith(WINDOWS_ZONE_IDENTIFIER_SUFFIX):
                    continue

                path = os.path.join(current_dir, filename)
                try:
                    os.remove(path)
                    removed += 1
                except OSError as exc:
                    failures.append(f"{path}: {exc}")

    if removed:
        print(f"Removed {removed} Windows Zone.Identifier files before Helm deployment")

    if failures:
        raise RuntimeError(
            "Could not remove Windows Zone.Identifier files:\n"
            + "\n".join(failures[:20])
        )


def docker_public_config_dir() -> str:
    config_dir = os.path.join(project_dir(), ".inesdata-local", "docker-config-public")
    os.makedirs(config_dir, exist_ok=True)

    config_file = os.path.join(config_dir, "config.json")
    if not os.path.isfile(config_file):
        with open(config_file, "w", encoding="utf-8") as handle:
            json.dump({}, handle)

    return config_dir


def docker_public_env():
    env = os.environ.copy()
    env["DOCKER_CONFIG"] = docker_public_config_dir()
    return env


def docker_public_env_prefix() -> str:
    return f"DOCKER_CONFIG={shlex.quote(docker_public_config_dir())}"


def local_script_path() -> str:
    return os.path.join(project_dir(), "adapters", "inesdata", "scripts", "local_build_load_deploy.sh")


def build_script_path() -> str:
    return os.path.join(project_dir(), "adapters", "inesdata", "scripts", "build_images.sh")


def seed_assets_script_path() -> str:
    return os.path.join(project_dir(), "scripts", "seed_ml_assets_for_connectors.sh")


def fast_step1_script_path() -> str:
    return os.path.join(project_dir(), "adapters", "inesdata", "scripts", "fast_step1_images.sh")


def persistent_manifests_dir() -> str:
    return os.path.join(project_dir(), PERSISTENT_MANIFEST_SUBDIR)


def canonical_persistent_manifest_path() -> str:
    return os.path.join(persistent_manifests_dir(), CANONICAL_STEP1_MANIFEST_NAME)


def _canonical_temp_manifest_path() -> str:
    return os.path.join(manifests_dir(), CANONICAL_STEP1_MANIFEST_NAME)


def _component_source_dir(component: str) -> str:
    return os.path.join(project_dir(), COMPONENT_SOURCE_SUBDIR_BY_KEY[component])


def _component_image_repositories(args):
    base = f"{args.local_registry_host}/{args.local_namespace}"
    return [
        f"{base}/{COMPONENT_IMAGE_NAME_BY_KEY[component]}"
        for component in COMPONENT_IMAGE_NAME_BY_KEY
    ]


def _filter_component_images(image_rows, repositories):
    selected = set()
    for row in image_rows:
        image_ref = row.strip().split()[0] if row.strip() else ""
        if not image_ref:
            continue
        if any(image_ref.startswith(f"{repo}:") for repo in repositories):
            selected.add(image_ref)
    return sorted(selected)


def cleanup_step_1_images(args):
    repositories = _component_image_repositories(args)

    docker_rows = (
        run("docker images --format '{{.Repository}}:{{.Tag}}'", capture=True, check=False, silent=True)
        or ""
    ).splitlines()
    docker_images = _filter_component_images(docker_rows, repositories)

    minikube_rows = (
        run(
            f"minikube -p {shlex.quote(args.minikube_profile)} image ls",
            capture=True,
            check=False,
            silent=True,
        )
        or ""
    ).splitlines()
    minikube_images = _filter_component_images(minikube_rows, repositories)

    if not docker_images and not minikube_images:
        print("No previous Step 1 local images found for INESData components")
        return

    if docker_images:
        print(f"Removing Docker images ({len(docker_images)})")
        failed = []
        for image_ref in docker_images:
            if run(f"docker rmi -f {shlex.quote(image_ref)}", check=False, silent=True) is None:
                failed.append(image_ref)
        if failed:
            print(f"Warning: failed to remove {len(failed)} Docker images")

    if minikube_images:
        print(f"Removing Minikube cached images ({len(minikube_images)})")
        failed = []
        for image_ref in minikube_images:
            if run(
                f"minikube -p {shlex.quote(args.minikube_profile)} image rm {shlex.quote(image_ref)}",
                check=False,
                silent=True,
            ) is None:
                failed.append(image_ref)
        if failed:
            print(f"Warning: failed to remove {len(failed)} Minikube cached images")


def resolve_platform_dir(platform_dir: str) -> str:
    candidate = platform_dir if os.path.isabs(platform_dir) else os.path.join(project_dir(), platform_dir)

    has_required_chart_dirs = (
        os.path.isdir(os.path.join(candidate, "dataspace"))
        and os.path.isdir(os.path.join(candidate, "connector"))
    )
    if has_required_chart_dirs:
        return candidate

    default_deployment = os.path.join(project_dir(), "inesdata-deployment")
    deployment_has_charts = (
        os.path.isdir(os.path.join(default_deployment, "dataspace"))
        and os.path.isdir(os.path.join(default_deployment, "connector"))
    )

    if deployment_has_charts:
        print(f"Auto-resolved platform charts directory: {default_deployment}")
        return default_deployment

    return candidate


def manifests_dir() -> str:
    return os.environ.get("MANIFESTS_DIR", "/tmp/inesdata-manifests")


def _manifest_search_dirs():
    return (persistent_manifests_dir(), manifests_dir())


def resolve_manifest_path(manifest_path: str) -> str:
    if manifest_path:
        candidate = manifest_path if os.path.isabs(manifest_path) else os.path.join(project_dir(), manifest_path)
        if os.path.isfile(candidate):
            return candidate
        raise RuntimeError(f"Manifest file not found: {candidate}")

    for preferred in (canonical_persistent_manifest_path(), _canonical_temp_manifest_path()):
        if os.path.isfile(preferred):
            return preferred

    for search_dir in _manifest_search_dirs():
        candidates = sorted(glob.glob(os.path.join(search_dir, "images-*.tsv")), reverse=True)
        if candidates:
            return candidates[0]

    raise RuntimeError(
        "No image manifest was found. Run the image build step first or provide --manifest"
    )


def _manifest_components(manifest_path: str):
    components = set()
    try:
        with open(manifest_path, "r", encoding="utf-8") as handle:
            for idx, raw_line in enumerate(handle):
                line = raw_line.strip()
                if not line:
                    continue
                if idx == 0 and line.startswith("component\t"):
                    continue
                component = line.split("\t", 1)[0].strip()
                if component:
                    components.add(component)
    except OSError:
        return set()
    return components


def _required_components_for_deploy_target(deploy_target: str):
    if deploy_target == "dataspace":
        return {"registration-service", "public-portal-backend", "public-portal-frontend"}
    if deploy_target == "connectors":
        return {"connector", "connector-interface"}
    return {
        "connector",
        "connector-interface",
        "registration-service",
        "public-portal-backend",
        "public-portal-frontend",
    }


def _expected_step1_components(args):
    if args.step1_components:
        return {item.strip() for item in args.step1_components.split(",") if item.strip()}

    if args.step1_mode == "initial":
        return {
            "connector",
            "connector-interface",
            "registration-service",
            "public-portal-backend",
            "public-portal-frontend",
        }

    return set()


def _validate_step1_manifest(args, manifest_path: str, expected_components=None):
    components = _manifest_components(manifest_path)
    if not components:
        raise RuntimeError(
            "Step 3 produced an empty manifest. "
            "Re-run Step 3 and verify component source directories under adapters/inesdata/sources"
        )

    expected = expected_components or _expected_step1_components(args)
    if expected and not expected.issubset(components):
        missing = sorted(expected - components)
        raise RuntimeError(
            "Step 3 manifest is incomplete. Missing components: "
            f"{', '.join(missing)}. Manifest: {manifest_path}"
        )


def _persist_step1_manifest(manifest_path: str) -> str:
    target_path = canonical_persistent_manifest_path()
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    if os.path.abspath(manifest_path) != os.path.abspath(target_path):
        shutil.copyfile(manifest_path, target_path)

    return target_path


def _split_image_reference(image_ref: str):
    cleaned = (image_ref or "").strip()
    if not cleaned:
        return "", ""

    if "@" in cleaned:
        repository, digest = cleaned.split("@", 1)
        return repository, digest

    last_slash = cleaned.rfind("/")
    last_colon = cleaned.rfind(":")
    if last_colon > last_slash:
        return cleaned[:last_colon], cleaned[last_colon + 1:]

    return cleaned, ""


def _component_from_image_reference(image_ref: str):
    repository, _ = _split_image_reference(image_ref)
    image_name = repository.rsplit("/", 1)[-1] if repository else ""
    return COMPONENT_KEY_BY_IMAGE_NAME.get(image_name, "")


def _recovered_manifest_path(args, deploy_target: str) -> str:
    safe_namespace = "".join(
        char if char.isalnum() or char in ("-", "_") else "-"
        for char in (getattr(args, "namespace", "") or "default")
    )
    return os.path.join(persistent_manifests_dir(), f"images-recovered-{safe_namespace}-{deploy_target}.tsv")


def _write_manifest(component_images, manifest_path: str):
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as handle:
        handle.write(MANIFEST_HEADER + "\n")
        for component in COMPONENT_IMAGE_NAME_BY_KEY:
            image_ref = component_images.get(component, "")
            if not image_ref:
                continue

            image_repo, image_tag = _split_image_reference(image_ref)
            row = [
                component,
                _component_source_dir(component),
                image_repo,
                image_tag,
                image_ref,
                "",
            ]
            handle.write("\t".join(row) + "\n")


def _deployed_component_images(args):
    namespace = shlex.quote(args.namespace)
    raw_output = run(
        f"kubectl get deploy -n {namespace} -o json",
        capture=True,
        check=False,
        silent=True,
    )
    if not raw_output:
        return {}

    try:
        payload = json.loads(raw_output)
    except json.JSONDecodeError:
        return {}

    component_images = {}
    for item in payload.get("items", []):
        pod_spec = item.get("spec", {}).get("template", {}).get("spec", {})
        for group_name in ("initContainers", "containers"):
            for container in pod_spec.get(group_name, []) or []:
                image_ref = (container.get("image") or "").strip()
                component = _component_from_image_reference(image_ref)
                if component and component not in component_images:
                    component_images[component] = image_ref

    return component_images


def _recover_manifest_from_deployed_images(args, deploy_target: str) -> str:
    required_components = _required_components_for_deploy_target(deploy_target)
    component_images = _deployed_component_images(args)
    if not required_components.issubset(component_images):
        return ""

    manifest_path = _recovered_manifest_path(args, deploy_target)
    _write_manifest(component_images, manifest_path)

    if required_components.issubset(_manifest_components(manifest_path)):
        return manifest_path

    return ""


def _candidate_manifests(preselected: str = ""):
    candidates = []

    def add_candidate(path: str):
        if not path:
            return
        if not os.path.isfile(path):
            return
        if path in candidates:
            return
        candidates.append(path)

    add_candidate(preselected)

    for preferred in (canonical_persistent_manifest_path(), _canonical_temp_manifest_path()):
        add_candidate(preferred)

    for search_dir in _manifest_search_dirs():
        for path in sorted(glob.glob(os.path.join(search_dir, "images-*.tsv")), reverse=True):
            add_candidate(path)

    return candidates


def ensure_prerequisites():
    if run("which docker", capture=True, check=False, silent=True) is None:
        raise RuntimeError("Docker is not installed or not found in PATH")

    if run("which minikube", capture=True, check=False, silent=True) is None:
        raise RuntimeError("Minikube is not installed or not found in PATH")

    if run("which helm", capture=True, check=False, silent=True) is None:
        raise RuntimeError("Helm is not installed or not found in PATH")

    if run("docker info", capture=True, check=False, silent=True) is None:
        raise RuntimeError("Docker daemon is not reachable. Start Docker and retry")


def print_manual_actions():
    print("\n" + "=" * 60)
    print("MANUAL ACTION REQUIRED BEFORE STEP 3 (DATASPACE)")
    print("=" * 60)
    print("1) Open another terminal and run:")
    print("   minikube tunnel")
    print("\n2) Open another terminal and run:")
    print(
        f"   cd {project_dir()} && "
        "kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80"
    )
    print("\nKeep both commands running during dataspace and connectors deployment.")
    print("=" * 60)


def _is_port_open(host: str, port: int, timeout_seconds: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout_seconds):
            return True
    except OSError:
        return False


def verify_manual_actions(timeout_seconds: int = 30) -> bool:
    tunnel_proc = run_silent('pgrep -af "minikube tunnel"')
    if not tunnel_proc:
        print("minikube tunnel process not detected")
        return False

    port_forward_proc = run_silent(
        'pgrep -af "kubectl.*port-forward.*ingress-nginx-controller.*8080:80"'
    )
    if not port_forward_proc:
        print("kubectl port-forward process for ingress-nginx-controller on 8080 not detected")
        return False

    started_at = time.time()
    while time.time() - started_at < timeout_seconds:
        if _is_port_open("127.0.0.1", 8080):
            return True
        time.sleep(1)

    print("Port 8080 is not reachable on localhost")
    return False


def wait_for_manual_confirmation(manual_ready: bool) -> bool:
    if manual_ready:
        print("Manual readiness was provided via flag. Continuing...")
        return True

    if not sys.stdin.isatty():
        print_manual_actions()
        print(
            "\nNon-interactive terminal detected. "
            "Run again with --resume-after-manual --manual-ready once manual actions are active."
        )
        return False

    print_manual_actions()
    input("\nWhen both commands are active, press ENTER to continue...")
    return True


def run_local_image_build(args) -> str:
    if args.skip_build:
        manifest = resolve_manifest_path(args.manifest)
        print(f"Using existing manifest: {manifest}")
        return manifest

    forced_components = {
        "connector",
        "connector-interface",
        "registration-service",
        "public-portal-backend",
        "public-portal-frontend",
    }

    print("Step 3 always rebuilds all INESData images from a clean local Docker image state.")
    print("Step 3 never loads images into minikube; image loading is reserved for Steps 4 and 5.")
    print("Step 3 forces legacy Docker builder mode for better WSL stability during full image rebuilds.")
    if args.step1_mode != "initial":
        print("Ignoring --step1-mode for Step 3 and forcing a full rebuild.")
    if args.step1_components:
        print("Ignoring --step1-components for Step 3 and rebuilding all components.")
    if args.step1_refresh_runtime:
        print("Ignoring --step1-refresh-runtime for Step 3; runtime refresh belongs to Steps 4 and 5.")
    if args.disable_buildkit:
        print("--disable-buildkit is redundant for Step 3 because legacy Docker builder mode is already enforced.")

    # Fail early with explicit diagnostics if Docker cannot fetch required base images.
    prefetch_base_images()

    script = fast_step1_script_path()
    if not os.path.isfile(script):
        raise RuntimeError(f"Fast Step 1 script not found: {script}")

    manifest_output = args.manifest or _canonical_temp_manifest_path()
    command_parts = [
        "bash",
        script,
        "--mode",
        "initial",
        "--namespace",
        args.namespace,
        "--minikube-profile",
        args.minikube_profile,
        "--registry-host",
        args.local_registry_host,
        "--registry-namespace",
        args.local_namespace,
        "--image-tag",
        args.step1_image_tag,
        "--manifest",
        manifest_output,
        "--skip-minikube-load",
    ]

    quoted_command = " ".join(shlex.quote(part) for part in command_parts)
    env_parts = [
        docker_public_env_prefix(),
        "DOCKER_BUILDKIT=0",
        "COMPOSE_DOCKER_CLI_BUILD=0",
    ]

    full_command = f"{' '.join(env_parts)} {quoted_command}" if env_parts else quoted_command

    if run(full_command, cwd=project_dir()) is None:
        raise RuntimeError("Fast Step 1 build workflow failed")

    manifest = resolve_manifest_path(manifest_output)
    _validate_step1_manifest(args, manifest, forced_components)
    manifest = _persist_step1_manifest(manifest)
    print(f"Image manifest selected: {manifest}")
    return manifest


def run_local_image_deploy(args, manifest_path: str, deploy_target: str = "all"):
    cleanup_windows_zone_identifier_files(args)

    script = local_script_path()
    if not os.path.isfile(script):
        raise RuntimeError(f"Local deployment script not found: {script}")

    platform_dir = resolve_platform_dir(args.platform_dir)
    if not os.path.isdir(platform_dir):
        raise RuntimeError(
            "Platform directory not found. "
            f"Expected: {platform_dir}. "
            "Use --platform-dir inesdata-deployment or an absolute path"
        )

    if not os.path.isdir(os.path.join(platform_dir, "dataspace")) or not os.path.isdir(
        os.path.join(platform_dir, "connector")
    ):
        raise RuntimeError(
            "Platform directory is missing required Helm chart folders ('dataspace' and 'connector'). "
            f"Provided: {platform_dir}. "
            "Use --platform-dir inesdata-deployment or a path containing both folders"
        )

    command_parts = [
        "bash",
        script,
        "--apply",
        "--platform-dir",
        platform_dir,
        "--namespace",
        args.namespace,
        "--minikube-profile",
        args.minikube_profile,
        "--skip-build",
        "--manifest",
        manifest_path,
        "--deploy-target",
        deploy_target,
    ]

    quoted_command = " ".join(shlex.quote(part) for part in command_parts)
    env_parts = [
        f"LOCAL_REGISTRY_HOST={shlex.quote(args.local_registry_host)}",
        f"LOCAL_NAMESPACE={shlex.quote(args.local_namespace)}",
    ]

    if args.disable_buildkit:
        env_parts.insert(0, "COMPOSE_DOCKER_CLI_BUILD=0")
        env_parts.insert(0, "DOCKER_BUILDKIT=0")

    env_prefix = " ".join(env_parts)

    full_command = f"{env_prefix} {quoted_command}"
    if run(full_command, cwd=project_dir()) is None:
        raise RuntimeError("Local build/load/deploy failed")


def run_validation_pipeline():
    command = f"{shlex.quote(sys.executable)} main.py inesdata validate"
    if run(command, cwd=project_dir()) is None:
        raise RuntimeError("Validation step failed")


def run_seed_assets_pipeline(
    args,
    seed_scope: str = "models",
    step_label: str = "Step 8",
    model_set_override: str | None = None,
    skip_use_case_models: bool = False,
    skip_inesdata_models: bool = False,
):
    script = seed_assets_script_path()
    if not os.path.isfile(script):
        raise RuntimeError(f"Seed assets script not found: {script}")

    if seed_scope not in {"models", "datasets", "all"}:
        raise RuntimeError(f"Invalid seed scope for {step_label}: {seed_scope}")

    seed_model_set = model_set_override or args.seed_model_set
    if seed_model_set == "auto":
        seed_model_set = args.model_server_mode
    if not skip_use_case_models and args.include_use_case_model_metadata and seed_model_set == "mock":
        seed_model_set = "use-cases"

    if seed_model_set == "combined":
        if args.combined_http_model_count < 1 or args.combined_http_model_count > COMBINED_HTTP_MODEL_MAX:
            raise RuntimeError(
                f"--combined-http-model-count must be between 1 and {COMBINED_HTTP_MODEL_MAX}"
            )
        if args.combined_inesdata_model_count < 0:
            raise RuntimeError("--combined-inesdata-model-count must be 0 or greater")

    command_parts = [
        "bash",
        script,
        "--namespace",
        args.namespace,
        "--count",
        str(args.seed_assets_count),
        "--connectors",
        args.seed_connectors,
        "--credentials-dir",
        args.seed_credentials_dir,
        "--vocabulary-id",
        args.seed_vocabulary_id,
        "--vocabulary-name",
        args.seed_vocabulary_name,
        "--vocabulary-category",
        args.seed_vocabulary_category,
        "--vocabulary-schema",
        args.seed_vocabulary_schema,
        "--seed-scope",
        seed_scope,
        "--model-set",
        seed_model_set,
        "--combined-http-count",
        str(args.combined_http_model_count),
        "--combined-inesdata-count",
        str(args.combined_inesdata_model_count),
    ]

    if args.seed_keycloak_token_url:
        command_parts.extend(["--keycloak-token-url", args.seed_keycloak_token_url])

    if skip_use_case_models:
        command_parts.append("--skip-use-case-models")

    if skip_inesdata_models:
        command_parts.append("--skip-inesdata-models")

    if seed_scope in ("models", "all") and seed_model_set in ("use-cases", "combined"):
        if not skip_use_case_models:
            command_parts.append("--include-use-case-models")
        if seed_model_set == "combined" or not skip_use_case_models:
            command_parts.extend(["--use-case-model-server-base-url", args.use_case_model_server_base_url])

    command = " ".join(shlex.quote(part) for part in command_parts)
    if run(command, cwd=project_dir()) is None:
        raise RuntimeError(f"{step_label} assets seeding failed")


def _normalize_http_url(value: str) -> str:
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return f"http://{value}"


def _ensure_validation_prerequisites(args, adapter):
    deployer_config = adapter.load_deployer_config() or {}
    keycloak_url = _normalize_http_url(
        deployer_config.get("KC_URL") or deployer_config.get("KC_INTERNAL_URL") or ""
    )

    if keycloak_url:
        realm_url = f"{keycloak_url}/realms/{args.namespace}"
        try:
            response = requests.get(realm_url, timeout=8)
            if response.status_code != 200:
                raise RuntimeError(
                    f"Keycloak realm '{args.namespace}' is not ready (HTTP {response.status_code}). "
                    "Run Step 3 (Dataspace deployment) first."
                )
        except requests.RequestException as exc:
            raise RuntimeError(
                "Unable to reach Keycloak for validation precheck. "
                "Ensure tunnel/port-forward are active and run Step 3 first."
            ) from exc

    connectors = adapter.get_cluster_connectors()
    if len(connectors) < 2:
        raise RuntimeError(
            "Validation requires at least 2 running connectors. "
            "Run Step 4 (Connectors deployment) first."
        )

    if not adapter.validate_connectors_deployment(connectors):
        raise RuntimeError(
            "Validation requires healthy connector backends. "
            "Run Step 4 (Connectors deployment) first."
        )


def _ensure_manual_prerequisites_for_recovery(args):
    if verify_manual_actions(timeout_seconds=args.manual_check_timeout):
        return

    if not wait_for_manual_confirmation(args.manual_ready):
        raise RuntimeError(
            "Manual actions were not confirmed. "
            "Start minikube tunnel and ingress port-forward, then press ENTER."
        )

    if not verify_manual_actions(timeout_seconds=args.manual_check_timeout):
        raise RuntimeError(
            "Manual prerequisites are not active. "
            "Ensure minikube tunnel and kubectl port-forward 8080:80 are running."
        )


def _select_manifest_for_deploy(args, manifest_path: str, deploy_target: str) -> str:
    required_components = _required_components_for_deploy_target(deploy_target)

    provided_manifest = ""
    if manifest_path:
        provided_manifest = manifest_path
    elif args.manifest:
        provided_manifest = resolve_manifest_path(args.manifest)

    for candidate in _candidate_manifests(provided_manifest):
        components = _manifest_components(candidate)
        if required_components.issubset(components):
            if provided_manifest and candidate != provided_manifest:
                print(f"Selected compatible manifest instead of incomplete one: {candidate}")
            return candidate

    recovered_manifest = _recover_manifest_from_deployed_images(args, deploy_target)
    if recovered_manifest:
        print(f"Recovered manifest from deployed images: {recovered_manifest}")
        return recovered_manifest

    raise RuntimeError(
        "No compatible image manifest found for deployment target "
        f"'{deploy_target}'. Required components: {', '.join(sorted(required_components))}. "
        "Run Step 3 (Build local images) to regenerate a complete manifest."
    )


def step_1_build(args) -> str:
    print("\n[Step 3/10] Build/rebuild local images from adapters/inesdata/sources")
    return run_local_image_build(args)


def _pull_image_with_retries(image_ref: str, attempts: int = 3, delay_seconds: int = 4) -> bool:
    for attempt in range(1, attempts + 1):
        print(f"Preparing base image ({attempt}/{attempts}): {image_ref}")
        result = subprocess.run(
            f"docker pull {shlex.quote(image_ref)}",
            shell=True,
            text=True,
            capture_output=True,
            env=docker_public_env(),
        )
        if result.returncode == 0:
            return True

        error_text = "\n".join(
            part for part in ((result.stdout or "").strip(), (result.stderr or "").strip()) if part
        )

        if attempt < attempts:
            if error_text:
                print(error_text)
            print(f"Base image pull failed. Retrying in {delay_seconds}s...")
            time.sleep(delay_seconds)
            continue

        if error_text:
            print(error_text)
    return False


def _configured_docker_hub_mirrors():
    configured = os.environ.get("INESDATA_DOCKER_HUB_MIRRORS", "").strip()
    if not configured:
        return DEFAULT_DOCKER_HUB_MIRRORS

    return tuple(item.strip().rstrip("/") for item in configured.split(",") if item.strip())


def _docker_hub_path(image_ref: str) -> str:
    """Return a Docker Hub repository path suitable for mirror registries."""
    ref = image_ref.strip()
    if not ref:
        return ""

    if ref.startswith("docker.io/"):
        ref = ref[len("docker.io/"):]

    has_namespace = "/" in ref
    first_segment = ref.split("/", 1)[0]
    has_explicit_registry = has_namespace and (
        "." in first_segment
        or ":" in first_segment
        or first_segment == "localhost"
    )
    if has_explicit_registry:
        return ""

    if "/" not in ref:
        return f"library/{ref}"

    return ref


def _docker_hub_mirror_refs(image_ref: str):
    hub_path = _docker_hub_path(image_ref)
    if not hub_path:
        return []

    return [
        f"{mirror}/{hub_path}"
        for mirror in _configured_docker_hub_mirrors()
    ]


def _tag_image(source_ref: str, target_ref: str) -> bool:
    print(f"Tagging mirror image {source_ref} as {target_ref}")
    result = subprocess.run(
        ["docker", "tag", source_ref, target_ref],
        text=True,
        capture_output=True,
        env=docker_public_env(),
    )
    if result.returncode == 0:
        return True

    error_text = "\n".join(
        part for part in ((result.stdout or "").strip(), (result.stderr or "").strip()) if part
    )
    if error_text:
        print(error_text)
    return False


def _pull_image_from_mirrors(image_ref: str) -> bool:
    mirror_refs = _docker_hub_mirror_refs(image_ref)
    if not mirror_refs:
        return False

    print(f"Trying Docker Hub mirrors for base image: {image_ref}")
    for mirror_ref in mirror_refs:
        if not _pull_image_with_retries(mirror_ref, attempts=2):
            continue

        if _tag_image(mirror_ref, image_ref):
            return True

    return False


def _extract_base_images_from_dockerfile(dockerfile_path: str):
    images = []
    try:
        with open(dockerfile_path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if not line.upper().startswith("FROM "):
                    continue

                tokens = line.split()
                if len(tokens) < 2:
                    continue

                # Supports syntaxes like:
                # FROM image:tag
                # FROM image:tag AS builder
                # FROM --platform=linux/amd64 image:tag AS builder
                image_token = ""
                for token in tokens[1:]:
                    if token.startswith("--"):
                        continue
                    image_token = token
                    break

                if image_token:
                    images.append(image_token)
    except OSError:
        return []

    return images


def _discover_step_1_base_images():
    sources_dir = os.path.join(project_dir(), "adapters", "inesdata", "sources")
    dockerfiles = [
        os.path.join(sources_dir, "inesdata-connector", "docker", "Dockerfile"),
        os.path.join(sources_dir, "inesdata-connector-interface", "docker", "Dockerfile"),
        os.path.join(sources_dir, "inesdata-registration-service", "docker", "Dockerfile"),
        os.path.join(sources_dir, "inesdata-public-portal-backend", "Dockerfile"),
        os.path.join(sources_dir, "inesdata-public-portal-frontend", "docker", "Dockerfile"),
    ]

    discovered = set()
    for dockerfile in dockerfiles:
        for image_ref in _extract_base_images_from_dockerfile(dockerfile):
            discovered.add(image_ref)

    return sorted(discovered)


def prefetch_base_images():
    base_images = _discover_step_1_base_images() or [
        "eclipse-temurin:17-jre-jammy",
        "eclipse-temurin:17-jre-alpine",
        "node:20.11-alpine",
        "node:18.16-alpine",
        "node:18-alpine",
        "nginx:alpine",
    ]

    print("Pre-fetching required base images for Step 3")
    failed_images = []

    for image_ref in base_images:
        already_present = run(
            f"docker image inspect {shlex.quote(image_ref)}",
            capture=True,
            check=False,
            silent=True,
        )
        if already_present is not None:
            continue

        if _pull_image_from_mirrors(image_ref):
            continue

        print(f"Mirror pull failed for {image_ref}. Trying direct Docker Hub pull...")
        if not _pull_image_with_retries(image_ref):
            failed_images.append(image_ref)

    if failed_images:
        docker_host = os.environ.get("DOCKER_HOST", "")
        context_name = run("docker context show", capture=True, check=False, silent=True) or "unknown"
        raise RuntimeError(
            "Unable to pull required base images for Step 3. "
            f"Failed images: {', '.join(failed_images)}. "
            f"Docker context: {context_name}. "
            f"DOCKER_HOST: {docker_host or '(not set)'}. "
            "Check DNS/proxy connectivity to registry-1.docker.io and configured mirrors, then retry."
        )


def _prefetch_dockerfile_base_images(dockerfile_path: str, step_label: str):
    base_images = _extract_base_images_from_dockerfile(dockerfile_path)
    if not base_images:
        return

    print(f"Pre-fetching required base images for {step_label}")
    failed_images = []

    for image_ref in base_images:
        already_present = run(
            f"docker image inspect {shlex.quote(image_ref)}",
            capture=True,
            check=False,
            silent=True,
        )
        if already_present is not None:
            continue

        if _pull_image_from_mirrors(image_ref):
            continue

        print(f"Mirror pull failed for {image_ref}. Trying direct Docker Hub pull...")
        if not _pull_image_with_retries(image_ref):
            failed_images.append(image_ref)

    if failed_images:
        docker_host = os.environ.get("DOCKER_HOST", "")
        context_name = run("docker context show", capture=True, check=False, silent=True) or "unknown"
        raise RuntimeError(
            f"Unable to pull required base images for {step_label}. "
            f"Failed images: {', '.join(failed_images)}. "
            f"Docker context: {context_name}. "
            f"DOCKER_HOST: {docker_host or '(not set)'}. "
            "Check DNS/proxy connectivity to registry-1.docker.io and configured mirrors, then retry."
        )


def step_2_common_services(args, adapter):
    print("\n[Step 1/10] Cluster setup and common services")
    cleanup_windows_zone_identifier_files(args)

    if args.skip_level1:
        print("Cluster setup skipped (--skip-level1)")
    else:
        adapter.setup_cluster()

    if args.skip_level2:
        print("Common services deployment skipped (--skip-level2)")
    else:
        adapter.deploy_infrastructure()


def step_2_manual_network_prerequisites(args, prompt_user: bool = True):
    print("\n[Step 2/10] Manual network prerequisites (tunnel + ingress port-forward)")

    if prompt_user:
        if not wait_for_manual_confirmation(args.manual_ready):
            raise RuntimeError(
                "Manual actions not confirmed. Run again after starting tunnel and port-forward."
            )
    elif not args.manual_ready:
        raise RuntimeError(
            "--resume-after-manual requires --manual-ready to confirm tunnel and port-forward"
        )

    if not verify_manual_actions(timeout_seconds=args.manual_check_timeout):
        raise RuntimeError(
            "Manual prerequisites are not active. "
            "Ensure minikube tunnel and kubectl port-forward 8080:80 are running."
        )


def step_3_dataspace(args, adapter_bootstrap, manifest_path: str):
    print("\n[Step 4/10] Dataspace deployment (local images)")
    cleanup_windows_zone_identifier_files(args)

    if not verify_manual_actions(timeout_seconds=args.manual_check_timeout):
        raise RuntimeError(
            "Manual prerequisites are not active. "
            "Ensure minikube tunnel and kubectl port-forward 8080:80 are running."
        )

    selected_manifest = _select_manifest_for_deploy(args, manifest_path, "dataspace")
    print("Applying dataspace bootstrap workflow...")
    adapter_bootstrap.deploy_dataspace()
    print("Applying local dataspace images...")
    run_local_image_deploy(args, selected_manifest, deploy_target="dataspace")
    return selected_manifest


def _force_restart_connector_deployments(args, connectors):
    connector_names = [connector for connector in (connectors or []) if connector]
    if not connector_names:
        return

    namespace = shlex.quote(getattr(args, "namespace", "demo") or "demo")
    print("Force restarting connector deployments before backend health validation...")

    for connector in connector_names:
        deployment_name = shlex.quote(connector)
        if run(
            f"kubectl rollout restart deployment/{deployment_name} -n {namespace}",
            check=False,
        ) is None:
            raise RuntimeError(
                f"Could not force restart connector deployment '{connector}' before backend validation"
            )

    for connector in connector_names:
        deployment_name = shlex.quote(connector)
        if run(
            f"kubectl rollout status deployment/{deployment_name} -n {namespace} --timeout=180s",
            check=False,
        ) is None:
            raise RuntimeError(
                f"Connector deployment '{connector}' did not become ready after forced restart"
            )


def step_4_connectors(args, adapter_bootstrap, manifest_path: str):
    print("\n[Step 5/10] Connectors deployment (local images)")
    cleanup_windows_zone_identifier_files(args)
    selected_manifest = _select_manifest_for_deploy(args, manifest_path, "connectors")
    print("Applying connectors bootstrap workflow...")
    connectors = adapter_bootstrap.deploy_connectors()
    print("Applying local connector images...")
    run_local_image_deploy(args, selected_manifest, deploy_target="connectors")
    _force_restart_connector_deployments(args, connectors)

    if not adapter_bootstrap.validate_connectors_deployment(connectors):
        raise RuntimeError(
            "Local connector images were applied, but connector backend health checks failed. "
            "Management and Protocol APIs are not ready."
        )

    return selected_manifest


def step_5_validation(args, adapter, adapter_bootstrap, manifest_path: str):
    if args.skip_validation:
        print("\n[Step 6/10] Validation skipped (--skip-validation)")
        return

    try:
        _ensure_validation_prerequisites(args, adapter)
    except RuntimeError as exc:
        print(f"Validation precheck failed: {exc}")
        print("Running automatic recovery for Step 5 prerequisites...")

        _ensure_manual_prerequisites_for_recovery(args)
        cleanup_windows_zone_identifier_files(args)
        selected_manifest = _select_manifest_for_deploy(args, manifest_path, "all")

        print("Recovery: bootstrap dataspace")
        adapter_bootstrap.deploy_dataspace()
        print("Recovery: apply local dataspace images")
        run_local_image_deploy(args, selected_manifest, deploy_target="dataspace")

        print("Recovery: bootstrap connectors")
        connectors = adapter_bootstrap.deploy_connectors()
        print("Recovery: apply local connector images")
        run_local_image_deploy(args, selected_manifest, deploy_target="connectors")
        _force_restart_connector_deployments(args, connectors)

        _ensure_validation_prerequisites(args, adapter)

    print("\n[Step 6/10] Validation tests")
    run_validation_pipeline()


def _model_server_manifest_for_namespace(k8s_manifest: str, namespace: str) -> str:
    safe_namespace = "".join(
        char if char.isalnum() or char in ("-", "_") else "-"
        for char in (namespace or "demo")
    )
    target_path = os.path.join(
        persistent_manifests_dir(),
        f"k8s-model-server-{safe_namespace}.yaml",
    )
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    with open(k8s_manifest, "r", encoding="utf-8") as handle:
        docs = list(yaml.safe_load_all(handle))

    for doc in docs:
        if not isinstance(doc, dict):
            continue
        metadata = doc.setdefault("metadata", {})
        if isinstance(metadata, dict):
            metadata["namespace"] = namespace

    with open(target_path, "w", encoding="utf-8") as handle:
        yaml.safe_dump_all(docs, handle, sort_keys=False)

    return target_path


def _model_server_rollout_timeout_seconds() -> int:
    raw_value = os.environ.get("MODEL_SERVER_ROLLOUT_TIMEOUT_SECONDS", "").strip()
    if not raw_value:
        return 300
    try:
        return max(1, int(raw_value))
    except ValueError:
        print(f"Invalid MODEL_SERVER_ROLLOUT_TIMEOUT_SECONDS value '{raw_value}'; using 300s")
        return 300


def _minikube_image_present(args, image_ref: str) -> bool:
    output = run(
        f"minikube -p {shlex.quote(args.minikube_profile)} image ls",
        capture=True,
        check=False,
        silent=True,
    )
    if not output:
        return False

    candidates = {
        image_ref,
        f"docker.io/library/{image_ref}",
    }
    return any(candidate in output for candidate in candidates)


def _load_model_server_image_into_minikube(args, sources_dir: str):
    image_ref = "model-server:latest"
    profile = shlex.quote(args.minikube_profile)

    if _minikube_image_present(args, image_ref):
        print(f"{image_ref} is already available in minikube.")
        return

    print("Loading model-server image into minikube...")
    load_cmd = f"minikube -p {profile} image load {shlex.quote(image_ref)}"
    if run(load_cmd, check=False) is not None and _minikube_image_present(args, image_ref):
        return

    print("Direct minikube image load did not make model-server visible; trying streamed docker load fallback...")
    stream_load_cmd = (
        f"docker save {shlex.quote(image_ref)} | "
        f"minikube -p {profile} ssh 'docker load'"
    )
    if run(stream_load_cmd, check=False) is not None and _minikube_image_present(args, image_ref):
        return

    print("Streamed load did not make model-server visible; trying minikube docker-env rebuild fallback...")
    fallback_build_cmd = (
        f"eval $(minikube -p {profile} docker-env) && "
        f"{docker_public_env_prefix()} DOCKER_BUILDKIT=0 docker build --pull=false "
        f"-t {shlex.quote(image_ref)} {shlex.quote(sources_dir)}"
    )
    if run(fallback_build_cmd, cwd=project_dir(), check=False) is None:
        raise RuntimeError("Failed to load model-server image into minikube")

    if not _minikube_image_present(args, image_ref):
        raise RuntimeError("model-server image was not visible in minikube after load/rebuild attempts")


def run_model_server_deploy(args):
    """Build model-server image, load into minikube, and apply K8s manifest."""
    sources_dir = os.path.join(project_dir(), "adapters", "inesdata", "sources", "model-server")
    dockerfile = os.path.join(sources_dir, "Dockerfile")
    k8s_manifest = os.path.join(sources_dir, "k8s-model-server.yaml")

    if not os.path.isfile(dockerfile):
        raise RuntimeError(f"Model server Dockerfile not found: {dockerfile}")
    if not os.path.isfile(k8s_manifest):
        raise RuntimeError(f"Model server K8s manifest not found: {k8s_manifest}")

    _prefetch_dockerfile_base_images(dockerfile, "Step 7 model-server build")

    print("Building model-server Docker image...")
    build_cmd = (
        f"{docker_public_env_prefix()} DOCKER_BUILDKIT=0 docker build --pull=false "
        f"-t model-server:latest {shlex.quote(sources_dir)}"
    )
    if run(build_cmd, cwd=project_dir()) is None:
        raise RuntimeError("model-server Docker image build failed")

    _load_model_server_image_into_minikube(args, sources_dir)

    namespaced_manifest = _model_server_manifest_for_namespace(k8s_manifest, args.namespace)

    print("Applying model-server Kubernetes manifest...")
    if run(f"kubectl apply -f {shlex.quote(namespaced_manifest)}") is None:
        raise RuntimeError("kubectl apply for model-server failed")

    print("Restarting model-server deployment to clear any previous failed rollout state...")
    if run(
        f"kubectl -n {shlex.quote(args.namespace)} rollout restart deployment/model-server",
        check=False,
    ) is None:
        raise RuntimeError("model-server deployment could not be restarted")

    print("Waiting for model-server pod to become ready...")
    timeout_seconds = _model_server_rollout_timeout_seconds()
    wait_cmd = (
        f"kubectl -n {shlex.quote(args.namespace)} rollout status deployment/model-server "
        f"--timeout={timeout_seconds}s"
    )
    if run(wait_cmd) is None:
        raise RuntimeError(f"model-server deployment did not become ready within {timeout_seconds}s")

    print("Model server deployed successfully.")


def _use_case_model_server_pid_file(args) -> str:
    return os.path.join(
        project_dir(),
        ".inesdata-local",
        f"use-case-model-server-{args.use_case_model_server_port}.pid",
    )


def _use_case_model_server_log_file(args) -> str:
    return os.path.join(
        project_dir(),
        ".inesdata-local",
        f"use-case-model-server-{args.use_case_model_server_port}.log",
    )


def _combined_model_server_pid_file(args) -> str:
    return os.path.join(
        project_dir(),
        ".inesdata-local",
        f"combined-model-server-{args.use_case_model_server_port}.pid",
    )


def _combined_model_server_log_file(args) -> str:
    return os.path.join(
        project_dir(),
        ".inesdata-local",
        f"combined-model-server-{args.use_case_model_server_port}.log",
    )


def _is_pid_running(pid: str) -> bool:
    if not pid or not pid.isdigit():
        return False
    return subprocess.run(
        ["kill", "-0", pid],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode == 0


def _validate_use_case_model_server_tree(args):
    server_dir = os.path.abspath(args.use_case_model_server_dir)
    python_candidates = _use_case_python_candidates(server_dir)
    python_bin = next((path for path in python_candidates if os.path.exists(path)), None)
    required_paths = [
        os.path.join(server_dir, "src", "server.py"),
        os.path.join(server_dir, "models", "flares"),
        os.path.join(server_dir, "models", "mobility"),
    ]
    missing = [path for path in required_paths if not os.path.exists(path)]
    if python_bin is None:
        missing.extend(python_candidates)

    if missing:
        raise RuntimeError(
            "Use-case model server is not ready. Missing paths: "
            + ", ".join(missing)
            + ". Train/prepare FLARES and Mobility before running Step 7 use-cases mode."
        )

    return server_dir, python_bin


def _wait_for_use_case_model_server(args, timeout_seconds: int = 90):
    url = f"http://127.0.0.1:{args.use_case_model_server_port}/models"
    deadline = time.time() + timeout_seconds
    last_error = ""

    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                payload = response.json()
                flares = payload.get("flares") or []
                mobility = payload.get("mobility") or []
                if flares and mobility:
                    print(
                        "Use-case model server is ready: "
                        f"{len(flares)} FLARES models, {len(mobility)} Mobility models"
                    )
                    return True
                last_error = f"server returned empty model groups: {payload}"
            else:
                last_error = f"HTTP {response.status_code}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(2)

    raise RuntimeError(f"Use-case model server did not become ready at {url}: {last_error}")


def _wait_for_combined_model_server(args, timeout_seconds: int = 90):
    models_url = f"http://127.0.0.1:{args.use_case_model_server_port}/models"
    mock_url = f"http://127.0.0.1:{args.use_case_model_server_port}/api/v1/vision/chest-xray"
    deadline = time.time() + timeout_seconds
    last_error = ""

    while time.time() < deadline:
        try:
            models_response = requests.get(models_url, timeout=5)
            if models_response.status_code != 200:
                last_error = f"/models returned HTTP {models_response.status_code}"
                time.sleep(2)
                continue

            payload = models_response.json()
            flares = payload.get("flares") or []
            mobility = payload.get("mobility") or []
            if not flares or not mobility:
                last_error = f"server returned empty model groups: {payload}"
                time.sleep(2)
                continue

            mock_response = requests.post(
                mock_url,
                json={"image_url": "https://example.com/xray.png", "image_size": "512x512"},
                timeout=5,
            )
            if mock_response.status_code == 200:
                print(
                    "Combined model server is ready: "
                    f"{len(flares)} FLARES models, {len(mobility)} Mobility models, "
                    f"{args.combined_http_model_count} mock HttpData endpoints"
                )
                return True
            last_error = f"mock endpoint returned HTTP {mock_response.status_code}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(2)

    raise RuntimeError(f"Combined model server did not become ready at {models_url}: {last_error}")


def run_use_case_model_server(args):
    """Start the external AIModelHub-Use-Cases FastAPI server on the host."""
    server_dir, python_bin = _validate_use_case_model_server_tree(args)
    os.makedirs(os.path.join(project_dir(), ".inesdata-local"), exist_ok=True)

    pid_file = _use_case_model_server_pid_file(args)
    log_file = _use_case_model_server_log_file(args)

    if os.path.isfile(pid_file):
        with open(pid_file, "r", encoding="utf-8") as handle:
            existing_pid = handle.read().strip()
        if _is_pid_running(existing_pid):
            print(f"Use-case model server already running with PID {existing_pid}")
            _wait_for_use_case_model_server(args, timeout_seconds=30)
            return

    if _is_port_open("127.0.0.1", args.use_case_model_server_port):
        print(f"Port {args.use_case_model_server_port} is already open; validating use-case model server")
        _wait_for_use_case_model_server(args, timeout_seconds=30)
        return

    cmd = (
        f"nohup {shlex.quote(python_bin)} -m uvicorn src.server:app "
        f"--host {shlex.quote(args.use_case_model_server_host)} "
        f"--port {shlex.quote(str(args.use_case_model_server_port))} "
        f"> {shlex.quote(log_file)} 2>&1 & echo $! > {shlex.quote(pid_file)}"
    )

    print("Starting use-case FastAPI model server...")
    print(f"Directory: {server_dir}")
    print(f"Host health URL: http://127.0.0.1:{args.use_case_model_server_port}/models")
    print(f"Connector-facing base URL: {args.use_case_model_server_base_url}")
    if run(cmd, cwd=server_dir) is None:
        raise RuntimeError("Use-case model server startup command failed")

    _wait_for_use_case_model_server(args)
    print(f"Use-case model server log: {log_file}")


def run_combined_model_server(args):
    """Start one FastAPI server for use-case models plus local mock HttpData endpoints."""
    if args.combined_http_model_count < 1 or args.combined_http_model_count > COMBINED_HTTP_MODEL_MAX:
        raise RuntimeError(
            f"--combined-http-model-count must be between 1 and {COMBINED_HTTP_MODEL_MAX}"
        )

    server_dir, python_bin = _validate_use_case_model_server_tree(args)
    os.makedirs(os.path.join(project_dir(), ".inesdata-local"), exist_ok=True)

    pid_file = _combined_model_server_pid_file(args)
    log_file = _combined_model_server_log_file(args)

    if os.path.isfile(pid_file):
        with open(pid_file, "r", encoding="utf-8") as handle:
            existing_pid = handle.read().strip()
        if _is_pid_running(existing_pid):
            print(f"Combined model server already running with PID {existing_pid}")
            _wait_for_combined_model_server(args, timeout_seconds=30)
            return

    if _is_port_open("127.0.0.1", args.use_case_model_server_port):
        print(f"Port {args.use_case_model_server_port} is already open; validating combined model server")
        _wait_for_combined_model_server(args, timeout_seconds=30)
        return

    python_path = os.pathsep.join([project_dir(), server_dir])
    cmd = (
        f"PYTHONPATH={shlex.quote(python_path)} "
        f"USE_CASE_SERVER_DIR={shlex.quote(server_dir)} "
        f"COMBINED_MOCK_HTTP_COUNT={shlex.quote(str(args.combined_http_model_count))} "
        f"nohup {shlex.quote(python_bin)} -m uvicorn combined_model_server.server:app "
        f"--host {shlex.quote(args.use_case_model_server_host)} "
        f"--port {shlex.quote(str(args.use_case_model_server_port))} "
        f"> {shlex.quote(log_file)} 2>&1 & echo $! > {shlex.quote(pid_file)}"
    )

    print("Starting combined FastAPI model server...")
    print(f"Use-case directory: {server_dir}")
    print(f"Host health URL: http://127.0.0.1:{args.use_case_model_server_port}/models")
    print(f"Combined mock URL sample: http://127.0.0.1:{args.use_case_model_server_port}/api/v1/vision/chest-xray")
    print(f"Connector-facing base URL: {args.use_case_model_server_base_url}")
    if run(cmd, cwd=server_dir) is None:
        raise RuntimeError("Combined model server startup command failed")

    _wait_for_combined_model_server(args)
    print(f"Combined model server log: {log_file}")


def step_7_model_server(args):
    if args.skip_model_server:
        print("\n[Step 7/10] Model server deployment skipped (--skip-model-server)")
        return

    if args.model_server_mode == "combined":
        print("\n[Step 7/10] Start combined FLARES/Mobility + mock HttpData FastAPI Model Server")
        run_combined_model_server(args)
        return

    if args.model_server_mode == "use-cases":
        print("\n[Step 7/10] Start FLARES/Mobility FastAPI Model Server")
        run_use_case_model_server(args)
        return

    print("\n[Step 7/10] Deploy ML Model Server (25 deterministic endpoints)")
    run_model_server_deploy(args)


def step_8_seed_assets(args):
    if args.skip_seed_assets:
        print("\n[Step 8/10] Base model asset seeding skipped (--skip-seed-assets)")
        return

    print("\n[Step 8/10] Seed vocabulary + base/mock ML model assets + model contracts")
    run_seed_assets_pipeline(args, seed_scope="models", step_label="Step 8", skip_use_case_models=True)


def step_9_seed_datasets(args):
    if args.skip_seed_datasets:
        print("\n[Step 9/10] Dataset seeding skipped (--skip-seed-datasets)")
        return

    print("\n[Step 9/10] Seed use-case datasets + dataset contracts")
    run_seed_assets_pipeline(args, seed_scope="datasets", step_label="Step 9")


def step_10_seed_use_case_model_assets(args):
    if args.skip_use_case_model_assets:
        print("\n[Step 10/10] Use-case model asset seeding skipped (--skip-use-case-model-assets)")
        return

    print("\n[Step 10/10] Seed FLARES/Mobility HttpData model assets + contracts")
    run_seed_assets_pipeline(
        args,
        seed_scope="models",
        step_label="Step 10",
        model_set_override="use-cases",
        skip_inesdata_models=True,
    )


def execute(args):
    ensure_prerequisites()

    adapter = InesdataAdapter(
        run=run,
        run_silent=run_silent,
        auto_mode_getter=lambda: False,
    )
    adapter_bootstrap = InesdataAdapter(
        run=run,
        run_silent=run_silent,
        auto_mode_getter=lambda: True,
    )

    manifest_path = ""

    if args.resume_after_manual:
        step_2_manual_network_prerequisites(args, prompt_user=False)
        manifest_path = step_1_build(args)
    else:
        step_2_common_services(args, adapter)
        step_2_manual_network_prerequisites(args, prompt_user=True)
        manifest_path = step_1_build(args)

    manifest_path = step_3_dataspace(args, adapter_bootstrap, manifest_path)
    manifest_path = step_4_connectors(args, adapter_bootstrap, manifest_path)
    step_5_validation(args, adapter, adapter_bootstrap, manifest_path)
    step_7_model_server(args)
    step_8_seed_assets(args)
    step_9_seed_datasets(args)
    step_10_seed_use_case_model_assets(args)

    print("\nLocal deployment completed with local images from adapters/inesdata/sources")
    return 0


def show_menu(args):
    """Display numbered local deployment menu analogous to inesdata.py."""
    ensure_prerequisites()

    adapter = InesdataAdapter(
        run=run,
        run_silent=run_silent,
        auto_mode_getter=lambda: False,
    )
    adapter_bootstrap = InesdataAdapter(
        run=run,
        run_silent=run_silent,
        auto_mode_getter=lambda: True,
    )
    manifest_path = ""

    while True:
        print("\n" + "=" * 60)
        print("LOCAL INESDATA DEPLOYMENT")
        print("=" * 60)
        print("\n[Full Deployment]")
        print("0 - Run all steps (1-10) sequentially")
        print("\n[Individual Steps]")
        print("1 - Step 1: Setup cluster + deploy common services")
        print("2 - Step 2: Confirm tunnel + ingress port-forward")
        print("3 - Step 3: Build local images")
        print("4 - Step 4: Deploy dataspace (local images)")
        print("5 - Step 5: Deploy connectors (local images)")
        print("6 - Step 6: Run validation tests")
        print("7 - Step 7: Deploy/Start ML Model Server")
        print("8 - Step 8: Seed vocabulary + base/mock ML model assets + contracts")
        print("9 - Step 9: Seed benchmark datasets + contracts")
        print("10 - Step 10: Seed FLARES/Mobility model assets + contracts")
        print("\n[Control]")
        print("Q - Exit")
        print("=" * 60)

        try:
            choice = input("\nSelection: ").strip().upper()
        except EOFError:
            print("\nNo more input. Exiting Local INESData Deployment\n")
            return 0

        if choice == "Q":
            print("\nExiting Local INESData Deployment\n")
            return 0

        if choice == "0":
            return execute(args)

        try:
            if choice == "1":
                step_2_common_services(args, adapter)
            elif choice == "2":
                step_2_manual_network_prerequisites(args, prompt_user=True)
            elif choice == "3":
                manifest_path = step_1_build(args)
            elif choice == "4":
                manifest_path = step_3_dataspace(args, adapter_bootstrap, manifest_path)
            elif choice == "5":
                manifest_path = step_4_connectors(args, adapter_bootstrap, manifest_path)
            elif choice == "6":
                step_5_validation(args, adapter, adapter_bootstrap, manifest_path)
            elif choice == "7":
                step_7_model_server(args)
            elif choice == "8":
                step_8_seed_assets(args)
            elif choice == "9":
                step_9_seed_datasets(args)
            elif choice == "10":
                step_10_seed_use_case_model_assets(args)
            else:
                print("\nInvalid selection. Please try again.\n")
        except KeyboardInterrupt:
            print("\n\nOperation cancelled by user\n")
        except Exception as exc:
            print(f"\nError during execution: {exc}\n")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Local deploy pipeline for AIModelHub Pionera using local component images"
    )
    parser.add_argument("--namespace", default="demo", help="Kubernetes namespace (default: demo)")
    parser.add_argument(
        "--platform-dir",
        default="inesdata-deployment",
        help=(
            "Platform chart directory relative to AIModelHub Pionera "
            "(default: inesdata-deployment)"
        ),
    )
    parser.add_argument(
        "--minikube-profile",
        default="minikube",
        help="Minikube profile name (default: minikube)",
    )
    parser.add_argument(
        "--local-registry-host",
        default="local",
        help="Registry host prefix used for local images (default: local)",
    )
    parser.add_argument(
        "--local-namespace",
        default="inesdata",
        help="Registry namespace used for local images (default: inesdata)",
    )
    parser.add_argument(
        "--step1-mode",
        choices=("initial", "changed"),
        default="initial",
        help="Compatibility flag for the fast image workflow; Step 3 always forces a full rebuild",
    )
    parser.add_argument(
        "--step1-components",
        default="",
        help="Compatibility flag; Step 3 always rebuilds all components",
    )
    parser.add_argument(
        "--step1-image-tag",
        default="dev",
        help="Stable Step 1 image tag used for all built components (default: dev)",
    )
    parser.add_argument(
        "--step1-refresh-runtime",
        action="store_true",
        help="Compatibility flag; Step 3 ignores it because runtime refresh belongs to Steps 4 and 5",
    )
    parser.add_argument(
        "--step1-skip-minikube-load",
        action="store_true",
        help="Compatibility flag; Step 3 already skips loading images to minikube",
    )
    parser.add_argument("--manifest", default="", help="Optional manifest TSV for prebuilt images")
    parser.add_argument("--skip-build", action="store_true", help="Skip image build and reuse manifest")
    parser.add_argument(
        "--disable-buildkit",
        action="store_true",
        help="Compatibility flag; Step 3 already forces legacy Docker builder mode",
    )
    parser.add_argument("--skip-level1", action="store_true", help="Skip cluster setup inside Step 2")
    parser.add_argument("--skip-level2", action="store_true", help="Skip common services deployment inside Step 2")
    parser.add_argument("--skip-validation", action="store_true", help="Skip validation phase")
    parser.add_argument("--skip-model-server", action="store_true", help="Skip Step 7 model server deployment")
    parser.add_argument("--skip-seed-assets", action="store_true", help="Skip Step 8 base/mock ML model assets initialization")
    parser.add_argument("--skip-seed-datasets", action="store_true", help="Skip Step 9 benchmark dataset initialization")
    parser.add_argument(
        "--skip-use-case-model-assets",
        action="store_true",
        help="Skip Step 10 FLARES/Mobility HttpData model asset initialization",
    )
    parser.add_argument(
        "--model-server-mode",
        choices=("mock", "use-cases", "combined"),
        default="combined",
        help=(
            "Step 7 model server mode: 'mock' deploys the existing deterministic K8s model-server; "
            "'use-cases' starts the external FLARES/Mobility FastAPI server on the host; "
            "'combined' starts one host FastAPI server with FLARES/Mobility plus mock HttpData endpoints"
        ),
    )
    parser.add_argument(
        "--use-case-model-server-dir",
        default=default_use_case_model_server_dir(),
        help=(
            "Directory containing the prepared AIModelHub-Use-Cases FastAPI project. "
            "By default this checks the bundled folder and then sibling layouts; override "
            "with this option or USE_CASE_MODEL_SERVER_DIR."
        ),
    )
    parser.add_argument(
        "--use-case-model-server-host",
        default="0.0.0.0",
        help="Host interface for the use-case FastAPI server (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--use-case-model-server-port",
        type=int,
        default=8000,
        help="Host port for the use-case FastAPI server (default: 8000)",
    )
    parser.add_argument(
        "--use-case-model-server-base-url",
        default="http://host.docker.internal:8000",
        help=(
            "Connector-facing base URL for FLARES/Mobility HttpData assets. "
            "For Docker-backed local Minikube this is usually http://host.docker.internal:8000"
        ),
    )
    parser.add_argument(
        "--include-use-case-model-metadata",
        action="store_true",
        help="Compatibility flag for direct model seeding; Step 10 registers FLARES/Mobility HttpData model assets",
    )
    parser.add_argument(
        "--seed-model-set",
        choices=("auto", "mock", "use-cases", "combined"),
        default="auto",
        help=(
            "Base model metadata set for Step 8. 'auto' follows --model-server-mode; "
            "Step 10 always seeds the FLARES/Mobility use-case model set."
        ),
    )
    parser.add_argument(
        "--combined-http-model-count",
        type=int,
        default=10,
        help="Extra mock HttpData endpoints/assets in combined mode, max 15 (default: 10)",
    )
    parser.add_argument(
        "--combined-inesdata-model-count",
        type=int,
        default=5,
        help="Extra InesDataStore assets in combined mode (default: 5)",
    )
    parser.add_argument(
        "--seed-assets-count",
        type=int,
        default=8,
        help="InesDataStore model assets per connector for mock/use-cases Step 8 modes (default: 8)",
    )
    parser.add_argument(
        "--seed-connectors",
        default="conn-citycouncil-demo,conn-company-demo",
        help="Comma-separated connectors to seed in Steps 8, 9 and 10",
    )
    parser.add_argument(
        "--seed-credentials-dir",
        default=os.path.join(project_dir(), "inesdata-deployment", "deployments", "DEV", "demo"),
        help="Credentials directory for Steps 8, 9 and 10 (default: inesdata-deployment/deployments/DEV/demo)",
    )
    parser.add_argument(
        "--seed-vocabulary-id",
        default="JS_Pionera_Daimo",
        help="Vocabulary ID to register/use in Steps 8, 9 and 10",
    )
    parser.add_argument(
        "--seed-vocabulary-name",
        default="JS Metadata Daimo",
        help="Vocabulary name for Steps 8, 9 and 10",
    )
    parser.add_argument(
        "--seed-vocabulary-category",
        default="machineLearning",
        help="Vocabulary category for Steps 8, 9 and 10",
    )
    parser.add_argument(
        "--seed-vocabulary-schema",
        default=os.path.join(project_dir(), "JS_Metadata_Daimo.schema.json"),
        help="Vocabulary schema file path for Steps 8, 9 and 10",
    )
    parser.add_argument(
        "--seed-keycloak-token-url",
        default="",
        help="Optional Keycloak token URL override for Steps 8, 9 and 10",
    )
    parser.add_argument(
        "--manual-check-timeout",
        type=int,
        default=30,
        help="Seconds to wait for localhost:8080 after tunnel/port-forward check (default: 30)",
    )
    parser.add_argument(
        "--manual-ready",
        action="store_true",
        help="Confirm that minikube tunnel and ingress port-forward are already active",
    )
    parser.add_argument(
        "--resume-after-manual",
        action="store_true",
        help="Resume from Step 3 after manual tunnel/port-forward setup",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run full local pipeline directly without interactive numbered menu",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    try:
        if args.non_interactive or not sys.stdin.isatty():
            return execute(args)
        return show_menu(args)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        return 130
    except Exception as exc:
        print(f"\nError: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
