# uso: java.sh <rotulo> <host> <modo> [opcoes da JVM...]    (modo: padrao | ocsp | soft)
L=$1; H=$2; M=$3; shift 3
printf '%-46s ' "$L"
java "$@" /clients/Cli.java $H 9443 $M 2>&1 | tail -1
