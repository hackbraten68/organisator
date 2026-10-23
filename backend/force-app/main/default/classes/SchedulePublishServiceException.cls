public class SchedulePublishServiceException extends Exception {
    private Integer statusCode;
    private String code;

    public SchedulePublishServiceException(Integer statusCode, String code, String message) {
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
