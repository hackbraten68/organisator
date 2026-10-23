/**
 * Eigene Exception-Klasse fuer den ScheduleService.
 *
 * Folgt dem Muster von AppointmentEditException: traegt statusCode + code
 * fuer eine kontrollierte Fehlerbehandlung im REST-Einstieg.
 */
public class ScheduleServiceException extends Exception {
    private Integer statusCode;
    private String code;

    public ScheduleServiceException(Integer statusCode, String code, String message) {
        this.statusCode = statusCode;
        this.code = code;
        this.setMessage(message);
    }

    public Integer getStatusCode() {
        return this.statusCode;
    }

    public String getCode() {
        return this.code;
    }
}
