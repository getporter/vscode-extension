export function findAll(source: string, text: string): number[] {
    const indexes = Array.of<number>();
    let searchedTo = 0;
    while (true) {
        const index = source.indexOf(text, searchedTo);
        if (index < 0) {
            return indexes;
        }
        indexes.push(index);
        searchedTo = index + text.length;
    }
}
