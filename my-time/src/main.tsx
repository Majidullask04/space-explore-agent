import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./styles/global.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// lets CSS scope script-dependent states: content stays visible without JS
document.documentElement.classList.add("js")
