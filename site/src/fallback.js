// Local preview of the same non-WebGL runtime deployed under /fallback/.
import "../../app/globals.css";
import {mountFocus} from "../../lib/focus-engine.js";
const dispose=mountFocus(document);
window.addEventListener("pagehide",dispose,{once:true});
window.addEventListener("pageshow",event=>{if(event.persisted)location.reload();});
