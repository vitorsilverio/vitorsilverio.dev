/* soma.c — funcao simples para ver o C virar assembly ARM.
   arm-none-eabi-gcc -c -O0 -march=armv4t -marm soma.c -o soma-O0.o
   arm-none-eabi-gcc -c -O2 -march=armv4t -marm soma.c -o soma-O2.o
   arm-none-eabi-objdump -d soma-O0.o
*/
int soma_ate(int n) {
    int acc = 0;
    for (int i = 1; i <= n; i++) {
        acc += i;
    }
    return acc;
}
