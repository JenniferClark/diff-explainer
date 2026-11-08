// Week 2 · Fri 10/23 —— Streaming 前端
// 放到 diff-explainer-web/src/streamExplain.ts
//
// 职责：发请求、读流、把字节拆成一条条 SSE 消息，再通过回调通知调用方。
// 它不知道 React 的存在，所以可以单独测试，也可以换到别的框架里用。

type ServerMessage =
  | { type: "delta"; text: string }
  | { type: "done"; input_tokens: number; output_tokens: number }
  | { type: "error"; message: string };

const API_BASE = "http://127.0.0.1:8000";

function parseMessage(raw: string): ServerMessage | null {
  console.log("raw: ", raw);
  for (const line of raw.split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice("data: ".length)) as ServerMessage;
    }
  }
  return null;
}
export async function streamExplain(diff: string): Promise<void> {
  console.log("[step 0] streamExplain called with: ", diff);
  console.log("[step 1] sending request...");

  // const start = performance.now()
  // console.log("performance -> ", performance)

  const res = await fetch(`${API_BASE}/explain/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diff }),
  });

  // const ms = Math.round(performance.now() - start);
  // console.log(`[step 1] fetch resolved after ${ms} ms`);
  // console.log("[step 1] status:", res.status);
  // console.log("[step 1] content-type:", res.headers.get("content-type"));
  // console.log("[step 1] body:", res.body);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = ""; // 新增：还没切出去的文字，先放在这里

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      console.log("[step 2] stream done");
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    console.log("buffer: ", buffer);

    let sep: number;

    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      // \n\n 之前的部分：一条完整的消息
      const raw = buffer.slice(0, sep);
      // \n\n 之后的部分：留在 buffer 里，等下一个 chunk
      buffer = buffer.slice(sep + 2);

      const msg = parseMessage(raw);
      console.log("[step 5] parsed:", msg);

      if (msg?.type === "delta") {
        console.log("[step 5]   text =", msg.text);
      }
    }
    console.log("[step 4]   leftover:", JSON.stringify(buffer));
  }
  console.log("[step 4] stream done, final buffer:", JSON.stringify(buffer));
}

/**
 * for each c from chunk
 *  buffer += c
 *
 *  record the index of \n\n: idx
 *
 *  while idx = buffer.index of (\n\n) exists
 *      get raw message from buffer : buffer.slice(0, idx)
 *      buffer = buffer.slice(idx + 2)
 */
/**
 * for each chunk c:
 *   buffer += c
 *
 *   while idx = buffer.indexOf("\n\n) !== -1:
 *      message = buffer.slice(0, idx)
 *      output(message)
 *      buffer = buffer.slice(idx + 2)
 */

// function feed(chunk) {
//     let buffer = "";
//     for (let c of chunk) {
//         buffer += c;
//
//         let idx;
//
//         while ((idx = buffer.indexOf("\n\n")) !== -1) {
//             const message = buffer.slice(0, idx)
//             console.log(message)
//             buffer = buffer.slice(idx + 2)
//         }
//         console.log(buffer)
//     }
// }
