#!/usr/bin/env sh
# Runs the host openssl, even on machines where it cannot load as installed.
# Some lab machines carry an older libcrypto that shadows the system one
# (Dell's /opt/dell/dcc, through LD_LIBRARY_PATH or ld.so.conf), and openssl
# dies before doing anything: "version `OPENSSL_3.0.3' not found". Pointing
# the loader at the system library directory first gets around it.
if ! command -v openssl >/dev/null 2>&1; then
  echo "  openssl not found" >&2
  exit 127
fi

if openssl version >/dev/null 2>&1; then
  exec openssl "$@"
fi

for libs in "/usr/lib/$(uname -m)-linux-gnu" /usr/lib64 /usr/lib; do
  if LD_LIBRARY_PATH="$libs" openssl version >/dev/null 2>&1; then
    export LD_LIBRARY_PATH="$libs"
    exec openssl "$@"
  fi
done

echo "  openssl is installed but cannot run on this machine:" >&2
openssl version 2>&1 >/dev/null | head -n 1 >&2
exit 1
