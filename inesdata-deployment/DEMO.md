## Instalar Minikube, Helm y crear clúster:
<details>
<summary> Minikube en un sistema tipo Unix: </summary>
<br>

Esta guía cubre lo necesario para instalar y ejecutar Minikube en un sistema tipo Unix. Esto incluye las siguientes opciones:
- En Linux
- En macOS
- En Windows desde Windows Subsystem for Linux (WSL)
### 
**IMPORTANTE**: Cuando se especifica abrir una terminal es necesario abrir una terminal
desde un sistema tipo Unix. Esto implica que si su sistema operativo es Windows, es
necesario abrir una terminal de WSL.
1. Abrir una terminal y ejecutar el siguiente comando:

```bash 
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
```
2. Ejecutar el siguiente comando
```bash 
sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
```
3. Comprobar que se ha instalado ejecutando:
```bash 
kubectl --help
```
</details>
<details>
<summary> Helm </summary>

Helm es un sistema para administrar aplicaciones de Kubernetes que en este caso facilita el despliegue de contenedores en el cluster de Minikube. La manera más fácil para instalarlo es utilizando un gestor de paquetes (como Snap) y para ello hay que seguir los siguientes pasos:

1. Instalar Helm ejecutando el siguiente comando:
```bash 
sudo snap install helm --classic
```
5. Comprobar que helm se ha instalado correctamente ejecutando el siguiente
comando
```bash 
helm version
```
</details>

<details>
<summary> Crear e inicializar clúster </summary>

**IMPORTANTE** es necesario ejecutar el comando especificado en el paso 1 cada vez que se
reinicia el ordenador (al apagar el ordenador la instancia de Minikube que simula el cluster se detiene). Recordad que es necesario
tener abierto Docker Desktop
1. Crear el cluster ejecutando el siguiente comando que se puede ajustar a las capacidades del hardware de la máquina. Es fundamental tener abierto
Docker Desktop. 
```bash
minikube start --driver=docker --cpus=4 --memory=4400
```
En este caso se indica que el driver a utilizar por Minikube es
docker, el número de cpus asociadas a kubernetes va a ser 2, y la RAM asociada
asociada a Kubernetes va a ser 4400 mb.

**PD:** Recordad que es necesario tener Docker Desktop abierto, si no os dará el siguiente error

2. Comprobar que el cluster se ha iniciado correctamente escribiendo
```bash
minikube status
```

3. Habilitar el complemento de Ingress
```bash
minikube addons enable ingress
```

Para verificar que se ha instalado correctamente hay que ejecutar el siguiente comando y
comprobar que te aparecen los pods de nginx.
```bash
kubectl get pods -n ingress-nginx
```

4. Para monitorizar el cluster desde el navegador se puede correr el siguiente servicio.
Se ejecuta en segundo plano para no bloquear la terminal.
```bash
minikube dashboard &
```

Para acceder al dashboard desde un navegador hay que acceder al enlace que aparece en
la terminal. Este enlace varía cada vez que se ejecuta el comando.

</details>

## Desplegar los servicios comunes:
El despliegue de los siguientes servicios (Keycloak, Minio, PostgreSQL y Vault) se realiza
mediante charts de helm. Para desplegar dichos servicios hay que seguir los siguientes
pasos:
1. Clonar el repositorio del deployer
(https://github.com/dataspaceunit/ds-local-deployment)
```bash
git clone https://github.com/dataspaceunit/ds-local-deployment
```
2. Acceder al directorio del repositorio clonado que a partir de ahora será el directorio raíz para todos los pasos siguientes.
```bash
cd ds-local-deployment/
```

3. El fichero situado en la ruta *./common/values.yaml*.
contiene las credenciales de administrador para acceder a los servicios comunes. Concretamente los usuarios para los servicios con sus respectivas contraseñas son: 
```json
keycloak:
    adminUser: admin
    adminPassword: aPassword1234
```
```json
postgresql:
    username: postgres
    postgresPassword: aPassword1234
```
```json
minio:
  rootUser: admin
  rootPassword: aPassword1234
```
Adicionalmente se inicializa una base de datos que conecta Keycloak con Postgresql con las siguientes credenciales:
```json
username: keycloak
password: aPassword1234
```
Las credenciales de esta guía pueden modificarse a gusto siempre y cuando el atributo postgresql -> auth -> password tenga el mismo valor que
el atributo keycloak -> externalDatabase -> password.

Además las variables de entorno en keycloak =>
keycloakConfigCli: KEYCLOAK_USER: En value hay que poner el mismo valor definido
en keycloak => auth => adminUser
y para KEYCLOAK_PASSWORD: En value hay que poner el mismo valor
definido en keycloak => auth => adminPassword.

4. Añadir los repos y dependencias de helm
```bash
helm repo add minio https://charts.min.io/
helm repo add hashicorp https://helm.releases.hashicorp.com
```
y construirlas dentro del directorio common:
```bash
cd common/
helm dependency build
``` 
este comando creará una carpeta con los Charts que serán desplegados más adelante. 

5. Añadir en el fichero de hosts las siguientes urls para ser accesibles desde el
navegador. 

- En Windows (aunque se esté utilizando WSL) el fichero hosts se
encuentra en `C:\Windows\System32\drivers\etc\hosts`. 

- En Linux el fichero de host se
encuentra en `/etc/hosts`:

- En macOS se encuentra en `private/etc/hosts`.

```
127.0.0.1 keycloak.dev.ed.dataspaceunit.upm
127.0.0.1 keycloak-admin.dev.ed.dataspaceunit.upm
127.0.0.1 minio.dev.ed.dataspaceunit.upm
127.0.0.1 console.minio-s3.dev.ed.dataspaceunit.upm
```
En caso de proseguir con el despliegue del espacio de datos demo (sin modificarle el nombre) junto con los dos conectores de ejemplo también se puede añadir las siguientes direcciones en este punto. 
```bash
127.0.0.1 registration-service-demo.dev.ds.dataspaceunit.upm
127.0.0.1 conn-citycouncil-demo.dev.ds.dataspaceunit.upm
127.0.0.1 conn-company-demo.dev.ds.dataspaceunit.upm
```
6. Desplegar los servicios comunes con el comando:
```bash
helm install -f values.yaml -n common-srvs --create-namespace common-srvs .
```
En caso de que haga falta borrar el despliegue hay que ejecutar el siguiente comando
```bash
helm uninstall common-srvs -n common-srvs
```
Si se quiere actualizar la configuración, ejecutar el siguiente comando
```bash
helm upgrade -f values.yaml -n common-srvs --create-namespace common-srvs .
```
Se puede monitorizar el despliegue o bien usando el dashboard de Minikube o bien ejecutando:
```bash
kubectl get pods -n common-srvs
```
Para comprobar que los servicios son accesibles hay que habilitar una ruta a los servicios desplegados usando: 
```bash
minikube tunnel
```
Este comando normalmente solicita la contraseña del ordenador en donde se está desplegando el sistema para funcionar.
Después de ejecutar el comando los servicios son accesibles desde el navegador escribiendo las urls que se han dado de alta en el fichero de hosts.

7. Hacer el unseal de Vault. Para ello hacemos los siguientes pasos:

**IMPORTANTE**: El unseal de Vault se recomienda realizarlo desde el directorio
*./common*. Esto es debido a que al ejecutar los comandos, que se
especifican a continuación, se genera un fichero ligado al despliegue de los servicios comunes.
- Obtener el id del pod de Vault ejecutando
```bash
kubectl get pods -n common-srvs
```
Por defecto es: *common-srvs-vault-0*.

Ejecutar el siguiente comando para iniciar el proceso de unseal dentro del pod. Este
comando genera un fichero llamado *init-keys-vault.json* en el mismo directorio donde se
ejecuta el comando. 
```bash
kubectl exec -it common-srvs-vault-0 -n common-srvs -- vault operator init -key-shares=1 -key-threshold=1 -format=json > init-keys-vault.json
```

En dicho fichero hay dos atributos importantes:
    
*unseal_keys_hex*: Contraseña utilizada para realizar el unseal de Vault.

*root_token*: Token maestro para acceder a Vault. Se utiliza para acceder a Vault.


Para hacer unseal de Vault ejecutar el siguiente comando haciendo la sustitución correspondiente a la contraseña para unseal de Vault.
```bash
kubectl exec -it common-srvs-vault-0 -n common-srvs -- vault operator unseal <unseal_keys_hex>
```

8. Configurar un nuevo motor de secretos de Vault mediante los siguientes pasos.
- Accedemos a la línea de comandos del pod que contiene Vault con el siguiente comando.
```sh
kubectl exec -it common-srvs-vault-0 -n common-srvs -- bin/sh
```
- Iniciamos sesión en Vault:
```bash
vault login
```
En este punto nos pide escribir el token de acceso que es el *root_token* del fichero *init-keys-vault.json*.
- Habilitamos el nuevo motor de secretos basado en kv en su versión 2 con la siguiente línea. 
```bash
vault secrets enable -path=secret kv-v2
```
- Finalmente salimos de la línea de comandos de Vault con:
```bash
exit
```
Muchas veces es necesario reiniciar el pod de Vault luego de esta tarea con el comando:
```bash
kubectl delete pod common-srvs-vault-0 -n common-srvs
```

Habiendo reiniciado el pod de Vault hay que repetir los pasos para realizar el unseal del mismo.
```bash
kubectl exec -it common-srvs-vault-0 -n common-srvs -- vault operator unseal <unseal_keys_hex>
```

# Crear espacio de datos y desplegar conectores:
## Configurar deployer:
1. Instalar python 3.10 siguiendo lo que pone en el siguiente enlace
https://gist.github.com/rutcreate/c0041e842f858ceb455b748809763ddb
2. Comprobar la versión de python escribiendo lo siguiente
```bash
python3 –-version
```
3. Situarnos en el directorio raíz
4. Crear un nuevo Python environment. Este comando va a crear un nuevo directorio en la ruta
`./.venv`
```bash
python3 -m venv .venv
```

5. Iniciar el environment

**IMPORTANTE**: Para que dicho comando funcione es necesario estar situado en el
directorio raíz
```bash
source .venv/bin/activate
```
6. Instalar los requisitos

**IMPORTANTE:** Para que dicho comando funcione es necesario estar situado en el
directorio raíz
```bash
pip install -r requirements.txt
```
7. Verificar los campos del fichero `deployer.config` de tal manera que coincidan con lo descrito abajo:
- PG_PASSWORD: El valor del fichero
`./common/values.yaml` especificado en postgresql =>
auth => postgresPassword
- KC_USER: El valor del fichero `./common/values.yaml`
especificado en keycloak => auth => adminUser
- KC_PASSWORD: El valor del fichero
`./common/values.yaml` especificado en keycloak => auth
=> adminPassword
- VT_TOKEN: Token de Vault. Está almacenado en el fichero `./common/init-keys-vault.json` en el atributo *root_token*. Este fichero se ha generado en
la sección “Desplegar los servicios comunes”.

## Crear un espacio de datos demo:
Para este ejemplo el espacio de datos tendrá como nombre **demo**. En el caso de elegir un nombre personalizado tiene que ser único. Además, por convención el nombre del espacio de datos no puede contener ni espacios, ni -,
ni _. Cabe destacar que no puede existir ya un espacio de datos con el nombre previamente seleccionado. 
Antes de crear el espacio de datos hay que también decidir un Namespace para el espacio de datos. Por convención dicho Namespace debe ser igual al nombre del espacio de datos.
Por ejemplo, para el espacio de datos demo, su Namespace sería también demo. 
En breve vamos a ejecutar el script *deployer.py* desde el directorio raíz, para ello es necesario primero:

1. Redireccionar los puertos tanto de Vault como de Postgresql. Se recomienda ejecutarlos en segundo plano para no
bloquear la terminal
```bash
kubectl port-forward common-srvs-postgresql-0 -n common-srvs 5432:5432 &
kubectl port-forward common-srvs-vault-0 -n common-srvs 8200:8200 &
```
2. En el directorio raíz y tener activado el entorno virtual de
python (el entorno virtual está activo si dentro de la terminal de WSL aparece (.venv)
a la izquierda).
```bash
source .venv/bin/activate
```
3. Crear el espacio de datos ejecutando el siguiente comando.
```bash
python deployer.py dataspace create demo
```
Si por lo que sea el comando falla, antes de volver a ejecutar el comando es necesario
ejecutar el comando delete con los mismos argumentos.
```bash
python deployer.py dataspace delete demo
```
4. Comprobar la IP de Minikube ejecutando el siguiente comando. La IP obtenida se va
a llamar a partir de ahora <minikube_ip>
```bash
minikube ip
```
5. El fichero dataspace/registration-service/values-demo.yaml debería haberse generado añadiendo al final las
urls de los servicios comunes así:
```bash
hostAliases:
- ip: "<minikube_ip>"
  hostnames:
  - "keycloak.dev.ed.dataspaceunit.upm"
  - "keycloak-admin.dev.ed.dataspaceunit.upm"
  - "minio.dev.ed.dataspaceunit.upm"
  - "console.minio-s3.dev.ed.dataspaceunit.upm"
```
En este punto también se pueden incluir por adelantado los hostnames de los conectores a desplegar, en nuestro ejemplo serían los siguientes.
```bash
  - "conn-citycouncil-demo.dev.ds.dataspaceunit.upm"
  - "conn-company-demo.dev.ds.dataspaceunit.upm"
```
6. Desplegar el registration service utilizando helm. Para ello ejecutamos los siguientes
comandos:
```bash
cd dataspace/registration-service
helm install -f values-demo.yaml -n demo --create-namespace demo-dataspace-rs .
```
Si se quiere desinstalar, ejecutar el siguiente comando
```bash
helm uninstall demo-dataspace-rs -n demo
```
Si se quiere actualizar la configuración, ejecutar el siguiente comando
```bash
cd dataspace/registration-service 
helm upgrade -f values-demo.yaml -n demo --create-namespace demo-dataspace-rs .
```

7. Comprobar que el pod se ha levantado correctamente. Para ello hay que ejecutar el
siguiente comando para poder identificar el ID del pod que se acaba de desplegar
```bash
kubectl get pods -n demo
```
Una vez que el pod aparezca que está desplegado, identificado el ID del pod, y que haya
pasado un tiempo prudencial (1 minuto más o menos) hay que comprobar los logs del
conector para comprobar realmente que el registration service se ha desplegado de manera
correcta. El identificador de dicho pod se va a llamar <pod_rs>.
```bash
kubectl logs <pod_rs> -n demo
```
8. En el caso de haber renombrado el espacio de datos hace falta añadir en el fichero de hosts las url del registration service para ser accesibles
desde el navegador. 
- En Windows (aunque se esté utilizando WSL) el fichero hosts se
encuentra en `C:\Windows\System32\drivers\etc\hosts`. 
- En Linux el fichero de host se
encuentra en `/etc/hosts`:
- En macOS se encuentra en `private/etc/hosts`.

La url del registration service sería
registration-service-demo.dev.ds.dataspaceunit.upm, por tanto en el fichero de hosts habría que
añadir 
```bash
127.0.0.1 registration-service-demo.dev.ds.dataspaceunit.upm
```
A continuación se procede a desplegar dos conectores necesarios para un espacio de datos mínimo viable.

## Crear un nuevo conector:
Antes de crear un conector hay que decidir a qué espacio de datos va a pertenecer dicho
conector (el espacio de datos debe de estar creado previamente). Para este ejemplo, el nombre del espacio de
datos al que va a pertenecer el conector se va a tomar como **demo**. 

Posteriormente,
hay que decidir un nombre único para dicho conector. Destacar que el nombre del conector
debe ser único para todos los espacios de datos. Si ya existe un conector con dicho nombre
(independientemente del espacio de datos al que pertenezca el conector), va a salir un error
al ejecutar el programa. En esta sección el nombre del conector se va a tomar como
**citycouncil**. 

Para que el nombre del conector sea único, por convención el nombre del
conector va a ser **conn-\<name\>-<ds_name>** donde:

- \<ds_name\> es el nombre del espacio de datos al que va a pertenecer dicho
conector, en este ejemplo será **demo**
- \<name\> es un nombre único dentro del espacio de datos al que va a pertenecer el
conector. Por convención este nombre único no puede contener ni espacios, ni -, ni
_. En este ejemplo sería **citycouncil**

Por ejemplo, un nombre válido puede ser **citycouncil** . Por ejemplo si dentro del espacio
de datos **demo** ya existe un conector llamado **conn-citycouncil-demo**, no puedo elegir **citycouncil**
cómo **\<name\>**

Habiendo elegido el nombre del conector se siguen los siguientes pasos para crearlo:

1. Redireccionar los puertos de postgresql y vault. Se recomienda que se ejecuten en segundo plano para no
bloquear la terminal.
```bash
kubectl port-forward common-srvs-postgresql-0 -n common-srvs 5432:5432 &
kubectl port-forward common-srvs-vault-0 -n common-srvs 8200:8200 &
```
2. Situarse en el directorio raíz y tener activado el entorno virtual de
python (el entorno virtual está activo si dentro de la terminal de WSL aparece (.venv)
a la izquierda).
```bash
cd inesdata-deployment
source venv/bin/activate
```
3. Hacer ejecutable el script .\scripts\generate-cert.sh hay que
hacerlo ejecutable ejecutando los siguientes comandos
```bash
cd scripts
chmod a+x generate-cert.sh
cd ..
```
4. Ejecutar el siguiente comando para crear el conector.
```bash
python deployer.py connector create conn-citycouncil-demo demo
```
Si por lo que sea el comando falla, antes de volver a ejecutar el comando es necesario
ejecutar el comando delete con los mismos argumentos.
```bash
python deployer.py connector delete conn-citycouncil-demo demo
```
5. Creación de bucket, política y usuario de MinIO. 
Comprobar el ID del Pod donde se encuentra desplegado Minio. Para ello hay que ejecutar
el siguiente comando. 
```bash
kubectl get pods -n common-srvs
```
El ID de Minio es el que empieza por comsrvs-minio, y se va a llamar
a partir de ahora **<pod_minio>**. A continuación se crea una copia de la política de MinIO dentro del contenedor:
```bash
cat deployments/DEV/demo/policy-demo-conn-citycouncil-demo.json | kubectl exec -i -n common-srvs <pod_minio> -- sh -c 'cat > /tmp/policy-demo-conn-citycouncil-demo.json'
```
Se llama a la línea de comandos del contenedor.
```bash
kubectl exec -it <pod_minio> -n common-srvs -- /bin/bash
```
Para los siguientes pasos necesitamos la contraseña del administrador de Minio. Esta contraseña se encuentra en
*./common/values.yaml* en minio => rootPassword. Si no se la ha modificado esta contraseña es
***aPassword1234***
```bash
mc alias set minio http://127.0.0.1:9000 admin aPassword1234
```
Se crea el bucket para el conector
```bash
mc mb minio/demo-conn-citycouncil-demo
```
Ahora se crean las credenciales de Minio para el conector. Dichas credenciales son
<minio.user>, <minio.passwd>, <access_key> y <secret_key> y
se encuentran en el fichero
`deployments/DEV/demo/credentials-connector-conn-citycouncil-demo.json`
```bash
mc admin user add minio conn-citycouncil-demo <minio.passwd>
mc admin user svcacct add minio conn-citycouncil-demo --access-key <access_key> --secret-key <secret_key>
```
Se crea la política con
```bash
mc admin policy create minio conn-citycouncil-demo-policy /tmp/policy-demo-conn-citycouncil-demo.json
```
Se la vincula al usuario de MinIO
```bash
mc admin policy attach minio conn-citycouncil-demo-policy -user=conn-citycouncil-demo
```
Se limpia el fichero de los archivos temporales
```bash
rm /tmp/policy-demo-conn-citycouncil-demo.json
```
Finalmente se sale de la terminal del contenedor ejecutando
```bash
exit
```
6. Verificar que el fichero *connector/values-conn-citycouncil-demo.yaml* tenga al final las urls de los servicios comunes y que la ip de hostAliases sea la misma que resulta de ejecutar `minikube ip`. 
El final del fichero antes mencionado debería verse así:
```bash
hostAliases:
- ip: "192.168.49.2"
  hostnames:
  - "keycloak.dev.ed.dataspaceunit.upm"
  - "keycloak-admin.dev.ed.dataspaceunit.upm"
  - "minio.dev.ed.dataspaceunit.upm"
  - "console.minio-s3.dev.ed.dataspaceunit.upm"
  - "registration-service-demo.dev.ds.dataspaceunit.upm"
```
Además en este punto también podemos incluir al final la url del segundo conector que vamos a desplegar más adelante.
```bash
  - "conn-company-demo.dev.ds.dataspaceunit.upm"
```
Cabe recalcar que para hacer descubribles los servicios en este ejemplo se usa el mecanismo de hostAliases lo que implica que cada conector que se despliegue hace necesario hacer un `helm upgrade` en los servicios comunes y en los conectores ya desplegados con la url del nuevo conector.

7. Desplegar el conector utilizando helm. Para ello ejecutamos los siguientes
comandos:
```bash
cd connector
helm install -f values-conn-citycouncil-demo.yaml -n demo conn-citycouncil-demo-demo .
```
Si se quiere desinstalar, ejecutar el siguiente comando
```bash
helm uninstall conn-citycouncil-demo-demo -n demo
```
Si se quiere actualizar la configuración, ejecutar el siguiente comando
```bash
cd connector
helm upgrade -f values-conn-citycouncil-demo.yaml -n demo conn-citycouncil-demo-demo .
```
8. Comprobar que el pod se ha levantado correctamente. Para ello hay que ejecutar el
siguiente comando para poder identificar el ID del pod que se acaba de desplegar
```bash
kubectl get pods -n demo
```
9. Finalmente para comprobar que el conector de verdad está levantado hay que
acceder a la url del conector poniendo al final `/dataspaceunit-connector-interface/`. 

Por
ejemplo:

http://conn-citycouncil-demo.dev.ds.dataspaceunit.upm/dataspaceunit-connector-interface/

Este link redirigirá a la pantalla de login de Keycloak para acceder a la interfaz del conector dentro del espacio de datos demo. Las credenciales de acceso son las que se encuentran en el fichero *deployments/DEV/demo/credentials-connector-conn-citycouncil-demo.json* bajo `connector_user` .

**IMPORTANTE**: Recordad que para poder acceder a los servicios expuestos en Minikube es
necesario ejecutar `minikube tunnel`

## Crear el segundo conector:
Para crear el segundo conector hace falta seguir del cuarto paso en adelante de la sección **Crear un nuevo conector** ajustando el nombre del mismo. En esta sección pegaremos directamente los comandos a ejecutar sin entrar demasiado a los detalles.

Para este ejemplo se usará **company** como el nombre del segundo conector, lo que significa que el conector se creará como **conn-company-demo** desde el directorio raíz.
```bash
 python deployer.py connector create conn-company-demo demo
 ```
Para la creación de bucket, política y usuario de MinIO. Ejecutamos en secuencia las siguientes líneas. 
```bash
kubectl get pods -n common-srvs
```
Obtenemos el ID de Minio es el que empieza por comsrvs-minio por ejemplo.
```bash
cat deployments/DEV/demo/policy-demo-conn-company-demo.json | kubectl exec -i -n common-srvs common-srvs-minio-6c855f4bf7-n2vbn -- sh -c 'cat > /tmp/policy-demo-conn-company-demo.json'
```
Se llama a la línea de comandos del contenedor.
```bash
kubectl exec -it common-srvs-minio-6c855f4bf7-n2vbn -n common-srvs -- /bin/bash
```
y ejecutamos lo siguiente para acceder como administrador y crear el bucket del nuevo conector:
```bash
mc alias set minio http://127.0.0.1:9000 admin aPassword1234
mc mb minio/demo-conn-company-demo
```
Se crean las credenciales de Minio para el conector: <minio.user>, <minio.passwd>, <access_key> y <secret_key> que se encuentran en el fichero
`deployments/DEV/demo/credentials-connector-conn-company-demo.json`
```bash
mc admin user add minio conn-company-demo HhAnLpswhMatsxVF
mc admin user svcacct add minio conn-company-demo --access-key 2kLZfGAZvNrZsVwO --secret-key E3FKSqC1tGEXFKdprXSw9zFFBoEY3td1uSci3mlM
```
Se crea la política, vincula al usuario y limpia de los archivos temporales con
```bash
mc admin policy create minio conn-company-demo-policy /tmp/policy-demo-conn-company-demo.json
mc admin policy attach minio conn-company-demo-policy -user=conn-company-demo
rm /tmp/policy-demo-conn-company-demo.json
```
Finalmente se sale de la terminal del contenedor ejecutando `exit`.

En este punto tenemos que incluir al final del fichero *connector/values-conn-company-demo.yaml* la url del primer conector ya desplegado. Al final debería verse así:
```bash
hostAliases:
- ip: "192.168.49.2"
  hostnames:
  - "keycloak.dev.ed.dataspaceunit.upm"
  - "keycloak-admin.dev.ed.dataspaceunit.upm"
  - "minio.dev.ed.dataspaceunit.upm"
  - "console.minio-s3.dev.ed.dataspaceunit.upm"
  - "registration-service-demo.dev.ds.dataspaceunit.upm"
  - "conn-citycouncil-demo.dev.ds.dataspaceunit.upm"
```
Hay que prestar especial atención especialmente a la última línea que contiene el hostname del otro conector ya instanciado.

Finalmente desplegamos el conector utilizando helm. Para ello ejecutamos los siguientes
comandos:
```bash
cd connector
helm install -f values-conn-company-demo.yaml -n demo conn-company-demo-demo .
```

Se puede acceder a la interfaz del nuevo conector mediante la URL del conector poniendo al final `/dataspaceunit-connector-interface/`. 

En este caso es
http://conn-company-demo.dev.ds.dataspaceunit.upm/dataspaceunit-connector-interface/

Para acceder con este nuevo conector las credenciales de acceso son las que se encuentran en el fichero *deployments/DEV/demo/credentials-connector-conn-company-demo.json* bajo `connector_user` .

## Portal público
Antes de desplegar el portal público hay que crear un primer conector. El despliegue
del portal público se explica en la sección “Crear el portal público”. Esto es
necesario porque para desplegar el portal público hay que crear un conector
especial llamado “conector promotor”. Lo único que tiene de especial este conector
es que el portal público va a hacer queries al catálogo de dicho conector para poder
mostrar información desde la web. Para crear un conector mirar la sección “Crear un
nuevo conector”.
