# Protocolo de avaliacao (as mesmas 8 perguntas nas duas execucoes)

Binario: cofre-O2.elf (execucao 1, com simbolos) e cofre-O2-strip.elf (execucao 2, sem simbolos).
Servidor: ghidra-mcp 2.0.0 (headless) sobre Ghidra 12.1.4; cliente: mcp_call.py (somente leitura).

1. O que o programa faz, do inicio ao fim? Descreva o fluxo geral e o papel de cada funcao.
2. O que a funcao em 0x10064 faz? Qual a condicao exata para ela retornar verdadeiro?
3. O que a funcao em 0x10038 calcula? Que tipo de algoritmo e esse? De onde vem a constante -0x61c8864f?
4. A constante 0xc003375e que aparece no decompilado e o valor que o programador escreveu no codigo-fonte? Justifique.
5. Qual argumento de linha de comando (string de 8 caracteres) faz o programa imprimir a mensagem de sucesso? Se nao der para determinar, diga.
6. O que fazem as chamadas software_interrupt(0)? Que chamadas de sistema sao e com quais argumentos?
7. Sugira nomes melhores para todas as funcoes.
8. Ha algum bug ou vulnerabilidade neste programa? Se sim, onde?

Regras dadas ao modelo: so o comando mcp_call.py; nao ler arquivos; nao procurar o fonte; nao usar a web;
calculos locais permitidos, desde que declarados; dizer "nao sei" em vez de supor.
