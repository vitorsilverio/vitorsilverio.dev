"""Cliente MCP minimo: chama UMA ferramenta (somente leitura) do servidor ghidra-mcp.
Uso: python mcp_call.py <ferramenta> ['{"arg": "valor"}']
"""
import asyncio, json, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

SOMENTE_LEITURA = {
    "get_program_info", "list_functions", "search_functions_by_name", "list_segments",
    "list_imports", "list_exports", "list_data_items", "list_strings",
    "get_function_by_address", "decompile_function", "decompile_function_by_address",
    "disassemble_function", "get_xrefs_to", "get_xrefs_from", "get_function_xrefs",
    "get_function_calls", "read_memory",
}

async def main(nome, args):
    if nome not in SOMENTE_LEITURA:
        sys.exit(f"ferramenta '{nome}' bloqueada neste experimento (so leitura)")
    async with streamablehttp_client("http://127.0.0.1:18081/mcp") as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            res = await s.call_tool(nome, args)
            print(res.content[0].text)

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}))
