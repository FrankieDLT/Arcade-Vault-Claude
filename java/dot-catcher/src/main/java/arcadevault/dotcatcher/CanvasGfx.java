package arcadevault.dotcatcher;

import org.teavm.jso.canvas.CanvasRenderingContext2D;
import org.teavm.jso.dom.html.HTMLCanvasElement;

/** Gfx on a Canvas 2D context, through TeaVM JSO. Copy this file as it is into a new Java game. */
final class CanvasGfx implements Gfx {
    private final CanvasRenderingContext2D ctx;

    CanvasGfx(HTMLCanvasElement canvas) {
        CanvasRenderingContext2D context = (CanvasRenderingContext2D) canvas.getContext("2d");
        if (context == null) {
            throw new IllegalStateException("2D canvas context is not available");
        }
        this.ctx = context;
    }

    @Override
    public void setColor(String css) {
        ctx.setFillStyle(css);
    }

    @Override
    public void fillRect(double x, double y, double w, double h) {
        ctx.fillRect(x, y, w, h);
    }

    @Override
    public void fillCircle(double x, double y, double r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}
