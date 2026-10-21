import { describe, expect, it } from 'vitest';

import { mesclarEnv } from './ga4-acesso.ts';

describe('mesclarEnv com .env salvo por editores do Windows', () => {
  it('ignora o BOM UTF-8 no início do arquivo e lê a primeira variável', () => {
    const arquivo = '\uFEFFGA4_PROPERTY_ID=123456789\nGA4_ACCESS_TOKEN=abc\n';

    const env = mesclarEnv({}, arquivo);

    expect(env['GA4_PROPERTY_ID']).toBe('123456789');
    expect(env['GA4_ACCESS_TOKEN']).toBe('abc');
  });

  it('lê valores com aspas, comentário no fim da linha e finais de linha CRLF', () => {
    const arquivo =
      'GA4_PROPERTY_ID="123456789" # propriedade\r\nGOOGLE_APPLICATION_CREDENTIALS=\'C:/chaves/ga4 leitor.json\'\r\n';

    const env = mesclarEnv({}, arquivo);

    expect(env['GA4_PROPERTY_ID']).toBe('123456789');
    expect(env['GOOGLE_APPLICATION_CREDENTIALS']).toBe('C:/chaves/ga4 leitor.json');
  });
});
