// Fetch scoped detail rows using a stable unique cursor. The server may
// cap a response below the requested size; only an empty page ends the scan.
export async function readAllById<T extends {id:string}>(fetchPage:(after:string|null)=>Promise<T[]>):Promise<T[]> {
  const rows:T[] = [];
  let after:string|null = null;
  while(true) {
    const page = await fetchPage(after);
    if (!page.length) return rows;
    for(const row of page) {
      if (!row.id || (after !== null && row.id <= after)) throw new Error('Paginação de detalhes inconsistente.');
      rows.push(row);after=row.id;
    }
  }
}
