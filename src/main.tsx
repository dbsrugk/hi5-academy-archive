import { createRoot } from "react-dom/client";
import "./app/globals.css";
import { installArchiveApi } from "./archive-api";
import Home from "./app/page";

installArchiveApi();
createRoot(document.getElementById("root")!).render(<Home />);
