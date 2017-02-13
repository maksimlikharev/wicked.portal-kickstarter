#!/usr/local/bin/dumb-init /bin/bash

set -e

if [ ! -z "${LOCAL_UID}" ] && [ ! -z "${LOCAL_GID}" ]; then
    echo "Creating local user in docker container..."
    groupadd -r usergroup --gid=${LOCAL_GID}
    useradd -r -g usergroup --uid=${LOCAL_UID} user

    echo "Running with UID ${LOCAL_UID} and GID ${LOCAL_GID}."
    # chown -R user:usergroup /var/portal-api
    gosu user node bin/kickstart "$@"
else
    node bin/kickstart "$@"
fi
