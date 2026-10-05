/**
 * Signalled when the signed-in internal staff user cannot be identified. Carries
 * the HTTP status and a stable machine-readable code so the backoffice UI can
 * react without string-matching on prose.
 *
 * Mirrors the portal's `PortalIdentityException` (owned by the `frontend`
 * project) rather than sharing it: the two projects deploy independently and a
 * class cannot be owned by both. The shape is intentionally identical so the
 * client handles both the same way.
 *
 * There is deliberately no custom constructor. On API 67 `Exception(String)` is
 * already inherited and cannot be redeclared, and `super(message)` is not
 * callable from a subclass. Build an instance with the inherited constructor and
 * set the extra data through init().
 */
public class StaffIdentityException extends Exception {
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