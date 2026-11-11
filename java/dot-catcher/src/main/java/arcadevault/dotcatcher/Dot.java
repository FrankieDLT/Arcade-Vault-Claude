package arcadevault.dotcatcher;

/** A falling dot. Instances are preallocated and reused, so the frame loop never allocates. */
final class Dot {
    double x;
    double y;
    double prevY; // position in the previous frame, used to detect crossing the paddle line
}
