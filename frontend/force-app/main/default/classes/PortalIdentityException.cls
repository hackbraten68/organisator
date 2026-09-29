/**
 * Signalled when the caller's portal identity cannot be resolved to exactly one
 * participant. Carries the HTTP status and a stable machine-readable code so the
 * portal UI can react without string-matching on prose.
 *
 * There is deliberately no custom constructor. On API 67 `Exception(String)` is
 * already inherited and cannot be redeclared, and `super(message)` is not
 * callable from a subclass. Build an instance with the inherited constructor and
 * set the extra data through init().
 */
public class PortalIdentityException extends Exception {
    private Integer statusCode;
    private String code;

    /** Sets the transport-level detail. Call after construction. */
    public void init(Integer statusCode, String code) {
        this.statusCode = statusCode;
        this.code = code;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public String getCode() {
        return code;
    }
}
