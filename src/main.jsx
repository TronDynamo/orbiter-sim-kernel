import {createRoot} from "react-dom/client";
import "./style.css";
import {GameApp} from "./game/GameApp.jsx";

createRoot(document.getElementById("root")).render(<GameApp />);
