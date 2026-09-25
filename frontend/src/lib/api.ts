export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

const isFormData =
  typeof FormData !== "undefined" &&
  options.body instanceof FormData;

if (
  options.body &&
  !isFormData &&
  !headers.has("Content-Type")
) {
  headers.set("Content-Type", "application/json");
}

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Pedido falhou com o código ${response.status}.`;

    try {
      const error = (await response.json()) as {
        detail?: string | Array<{ msg?: string }>;
      };

      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        message = error.detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join(" ");
      }
    } catch {
      // Mantém a mensagem genérica quando a resposta não é JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}