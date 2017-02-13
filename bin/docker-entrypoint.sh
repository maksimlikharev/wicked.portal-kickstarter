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
        groupadd -r usergroup --gid=${LOCAL_GID}
    fi
    # Running as root?
    if [ ! "${LOCAL_UID}" = "0" ]; then
        echo "Not running as root..."
        if [ ! "${LOCAL_GID}" = "0" ]; then
            echo "Creating user with special group and UID ${LOCAL_UID}..."
            useradd -r -g usergroup --uid=${LOCAL_UID} user
        else
            echo "Creating user with group 'root' and UID ${LOCAL_UID}..."
            useradd -r -g root --uid=${LOCAL_UID} user
        fi
        echo "Running with UID ${LOCAL_UID} and GID ${LOCAL_GID}."
        startedNode=1
        gosu user node bin/kickstart "$@"
    fi
fi

if [ startedNode=0 ]; then
    echo "Running kickstarter as root..."
    node bin/kickstart "$@"
fi
