import asyncio, json, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client("http://127.0.0.1:18081/mcp") as (r, w, _):
        async with ClientSession(r, w) as s:
            init = await s.initialize()
            print("servidor:", init.serverInfo.name, init.serverInfo.version, "| protocolo:", init.protocolVersion)
            tools = await s.list_tools()
            print(len(tools.tools), "ferramentas:", ", ".join(t.name for t in tools.tools))
            for nome, args in [("get_program_info", {}), ("list_functions", {}), ("decompile_function", {"name": "chave_ok"}), ("get_function_calls", {"address":"0x100b0"}), ("list_strings", {})]:
                res = await s.call_tool(nome, args)
                print("\n>>>", nome, args)
                print(res.content[0].text[:3500])
asyncio.run(main())
