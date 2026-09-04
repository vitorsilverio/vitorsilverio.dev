/* user.ld — script mínimo para os exemplos Linux user-mode da trilha.
   Equivale a `-Ttext=0x10000`, mas explícito: uma região, uma seção, um entry. */
ENTRY(_start)

MEMORY
{
    RAM (rwx) : ORIGIN = 0x00010000, LENGTH = 64K
}

SECTIONS
{
    .text : {
        *(.text*)
        *(.rodata*)
    } > RAM

    .data : { *(.data*) } > RAM
    .bss  : { *(.bss*)  } > RAM
}
