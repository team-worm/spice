export class SpiceError {
    public code: number; //Unique code identifying this error type.
    public name: string; //Unique human readable name for this error type.
    public message: string; //Human readable error message.
    public data: any; //Data specific to this error.
}