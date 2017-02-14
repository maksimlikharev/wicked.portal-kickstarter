#!/usr/local/bin/dumb-init /bin/bash

set -e

# On Linux, you will potentially run into permission problems if
# you do not pass in LOCAL_UID and LOCAL_GID; in case you pass in
# these two variables, the kickstarter will run as a user having
# these numeric IDs for user id and group id.
startedNode=0
if [ ! -z "${LOCAL_UID}" ] && [ ! -z "${LOCAL_GID}" ]; then
    if [ ! "${LOCAL_GID}" = "0" ]; then
        echo "Adding group with GID ${LOCAL_GID}..."
        if groupadd -r usergroup --gid=${LOCAL_GID}; then
            echo "Succeeded."
        else
            echo "Did not succeed, assuming group already present."
        fi
    fi
    # Running as root?
    if [ ! "${LOCAL_UID}" = "0" ]; then
        username="localuser"
        if [ ! "${LOCAL_UID}" = "1000" ]; then
            echo "Not running as root or user node..."
            echo "Creating user..."
            useradd -r -g ${LOCAL_GID} --uid=${LOCAL_UID} localuser
        else
            echo "Using predefined user 'node' (UID 1000)."
            localuser="node"
        fi
        echo "Running with UID ${LOCAL_UID} and GID ${LOCAL_GID}."
        startedNode=1
        gosu $localuser node bin/kickstart "$@"
    fi
fi

if [ startedNode=0 ]; then
    echo "Running kickstarter as root..."
    node bin/kickstart "$@"
fi
