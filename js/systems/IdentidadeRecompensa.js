const GIS_URL = "https://accounts.google.com/gsi/client";
const CLIENT_ID = "331191695151-ku8mdhd76pc2k36itas8lm722krn0u64.apps.googleusercontent.com";
let carregamento;

function carregarGoogle() {
  if (globalThis.google?.accounts?.id) return Promise.resolve(globalThis.google.accounts.id);
  return carregamento ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_URL;
    script.async = true;
    script.onload = () => globalThis.google?.accounts?.id
      ? resolve(globalThis.google.accounts.id) : reject(new Error("Google Identity indisponível"));
    script.onerror = () => reject(new Error("Google Identity indisponível"));
    document.head.append(script);
  });
}

export async function autenticarRecompensa(prepararBotao) {
  const googleId = await carregarGoogle();
  return new Promise((resolve, reject) => {
    googleId.initialize({
      client_id: CLIENT_ID,
      callback: resposta => {
        if (typeof resposta?.credential === "string" && resposta.credential) resolve(resposta.credential);
        else reject(new Error("Credencial Google indisponível"));
      },
    });
    prepararBotao(elemento => googleId.renderButton(elemento, { theme: "outline", text: "signin_with" }));
    googleId.prompt();
  });
}
