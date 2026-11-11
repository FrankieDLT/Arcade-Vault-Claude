package arcadevault.dotcatcher;

/**
 * The only drawing API the engine uses. An existing Java2D game swaps its Graphics2D calls for
 * these. Origin top-left, logical pixels, colors as CSS strings.
 */
interface Gfx {
    void setColor(String css);

    void fillRect(double x, double y, double w, double h);

    void fillCircle(double x, double y, double r);
}
