# INESData Deployment Bundle

This directory contains the local platform charts, templates and deployment
automation used by AIModelHub Pionera.

The local deploy pipeline uses this bundle for:

- common services: PostgreSQL, MinIO, Keycloak and Vault
- dataspace services: registration-service and public portal
- connector services and connector interface
- optional component charts under `components/`

Runtime files such as Vault keys, connector credentials and generated policies
are intentionally not versioned in this bundle. They are created during a local
deployment under `deployments/DEV/<namespace>/`.
