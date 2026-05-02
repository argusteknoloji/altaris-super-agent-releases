namespace Altaris.Infrastructure.Embeddings;

/// <summary>
///   Markdown/text chunking — paragraf-aware sliding window.
///   Tek bir LLM context window'una sığacak küçük parçalar üretir,
///   adjacent chunk'lar arasında overlap bırakır (semantic continuity).
///
///   Kararlar:
///   - Default chunk = 512 token ≈ 2048 karakter (TR ortalama 4 char/token).
///   - Overlap = 64 token ≈ 256 karakter — paragraf sınırında kesmemek için.
///   - Markdown başlıkları (#, ##) kendi başına bir chunk'a güçlü tercih.
///   - Code block'ları (``` … ```) bölmemek için tek-parça korunur.
///
///   Token sayımı için tiktoken eklenecek (Sprint EB-1.1) — şu an
///   karakter-based heuristic 4:1.
/// </summary>
public static class Chunker
{
    public record Chunk(int Index, string Text);

    public static IReadOnlyList<Chunk> Split(string content, int maxChars = 2048, int overlapChars = 256)
    {
        if (string.IsNullOrWhiteSpace(content)) return Array.Empty<Chunk>();
        var chunks = new List<Chunk>();
        var paragraphs = SplitParagraphs(content);

        var buffer = new System.Text.StringBuilder();
        var index = 0;
        foreach (var p in paragraphs)
        {
            // Çok büyük paragraf (kod bloğu vb.) tek-parça eklenir, sonra
            // ayrıca chunk olarak da çıkar — overlap atlanır.
            if (p.Length > maxChars)
            {
                if (buffer.Length > 0)
                {
                    chunks.Add(new Chunk(index++, buffer.ToString().Trim()));
                    buffer.Clear();
                }
                // Büyük paragrafı maxChars * 1.5 sınırına kadar tek chunk olarak
                // tut; daha büyükse zorla böl (kod bloğu veya devasa table).
                if (p.Length > maxChars * 1.5)
                {
                    for (int i = 0; i < p.Length; i += maxChars)
                        chunks.Add(new Chunk(index++, p.Substring(i, Math.Min(maxChars, p.Length - i))));
                }
                else
                {
                    chunks.Add(new Chunk(index++, p));
                }
                continue;
            }

            if (buffer.Length + p.Length + 2 > maxChars)
            {
                // Buffer doldu — flush + yeni buffer'da overlap için son
                // overlapChars karakteri tekrar başa al.
                var text = buffer.ToString().Trim();
                chunks.Add(new Chunk(index++, text));
                var carry = text.Length > overlapChars ? text[^overlapChars..] : text;
                buffer.Clear();
                buffer.Append(carry).Append("\n\n");
            }
            buffer.Append(p).Append("\n\n");
        }
        if (buffer.Length > 0)
            chunks.Add(new Chunk(index, buffer.ToString().Trim()));

        return chunks;
    }

    /// <summary>
    ///   Boş satırla ayrılan paragraflara böl. Markdown header'larını
    ///   (#, ##) bağımsız paragraf say (önündeki içeriğe yapışmasın).
    /// </summary>
    private static List<string> SplitParagraphs(string content)
    {
        var lines = content.Replace("\r\n", "\n").Split('\n');
        var paras = new List<string>();
        var buf = new System.Text.StringBuilder();
        var inCode = false;

        void Flush()
        {
            var s = buf.ToString().Trim();
            if (s.Length > 0) paras.Add(s);
            buf.Clear();
        }

        foreach (var line in lines)
        {
            // Code block toggle
            if (line.StartsWith("```"))
            {
                if (!inCode) { Flush(); inCode = true; }
                buf.AppendLine(line);
                if (inCode && line.Length == 3) { /* opener */ }
                else if (line.StartsWith("```") && inCode && buf.ToString().Count(c => c == '\n') > 1)
                {
                    inCode = false;
                    Flush();
                }
                continue;
            }
            if (inCode) { buf.AppendLine(line); continue; }

            if (string.IsNullOrWhiteSpace(line)) { Flush(); continue; }
            if (line.StartsWith("#")) { Flush(); buf.AppendLine(line); Flush(); continue; }
            buf.AppendLine(line);
        }
        Flush();
        return paras;
    }
}
