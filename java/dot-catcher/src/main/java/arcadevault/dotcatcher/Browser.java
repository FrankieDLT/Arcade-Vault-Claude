package arcadevault.dotcatcher;

import org.teavm.jso.JSBody;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;
import org.teavm.jso.dom.events.KeyboardEvent;

/** Small JSO helpers for the browser APIs the engine needs. Copy this file into a new Java game. */
final class Browser {
    private Browser() {}

    /** A JavaScript function that receives the requestAnimationFrame timestamp (milliseconds). */
    @JSFunctor
    interface FrameHandler extends JSObject {
        void frame(double timestamp);
    }

    /** A JavaScript function that receives a keyboard event. */
    @JSFunctor
    interface KeyHandler extends JSObject {
        void key(KeyboardEvent event);
    }

    /** A JavaScript function that ignores its argument (blur, visibilitychange). */
    @JSFunctor
    interface PlainHandler extends JSObject {
        void run();
    }

    @JSBody(params = {"handler"}, script = "return window.requestAnimationFrame(handler);")
    static native int requestFrame(FrameHandler handler);

    @JSBody(params = {"id"}, script = "window.cancelAnimationFrame(id);")
    static native void cancelFrame(int id);

    // The handler parameters are typed with the functor interfaces on purpose: that is what makes
    // TeaVM turn the Java lambda into a real JavaScript function at the call.
    @JSBody(params = {"type", "handler"}, script = "window.addEventListener(type, handler);")
    static native void addKeyListener(String type, KeyHandler handler);

    @JSBody(params = {"type", "handler"}, script = "window.removeEventListener(type, handler);")
    static native void removeKeyListener(String type, KeyHandler handler);

    @JSBody(params = {"type", "handler"}, script = "window.addEventListener(type, handler);")
    static native void addWindowListener(String type, PlainHandler handler);

    @JSBody(params = {"type", "handler"}, script = "window.removeEventListener(type, handler);")
    static native void removeWindowListener(String type, PlainHandler handler);

    @JSBody(params = {"type", "handler"}, script = "document.addEventListener(type, handler);")
    static native void addDocumentListener(String type, PlainHandler handler);

    @JSBody(params = {"type", "handler"}, script = "document.removeEventListener(type, handler);")
    static native void removeDocumentListener(String type, PlainHandler handler);

    @JSBody(script = "return document.hidden === true;")
    static native boolean isDocumentHidden();
}
