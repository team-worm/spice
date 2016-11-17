#[derive(Serialize, Deserialize)]
struct Error {
    code: i32, //unique code identifying error type
    name: String, //Unique human readable name for error
    message: String, //Human readable error message
    data: String, //TODO:  this needs to be another struct.  Data specific to error
}

#[derive(Serialize, Deserialize)]
struct File {
    name: String, //Name of file
    path: String, //Path to file
    f_type: String, //file or directory
    contents: String, //TODO:  make this a vector of File objects
}

#[derive(Serialize, Deserialize)]
struct Process {
    id: i32, //Identifying number of process on host machine
    name: String, //Name of process on host machine
}

#[derive(Serialize, Deserialize)]
struct Execution {
    id: i32, //Unique identifier
    e_type: String, //type of execution.  Either 'function' or 'process'
    status: String, // Either `pending`, `executing`, `stopped`, or `done`
    executionTime: i32, //nanoseconds
    data: String, //TODO:  this needs to be an object that contains data specific to this type
}

#[derive(Serialize, Deserialize)]
struct Trace {
    index: i32,
    t_type: i32,
    line: i32,
    data: String, //TODO:  needs to be an object that contains data specific to this type
}

#[derive(Serialize, Deserialize)]
struct Function {
    address: i32,
    name: String,
    sourcePath: String,
    lineNumber: i32,
    lineCount: i32,
    parameters: String,  //TODO:  make this an array of function parameter objects {name: string, type: SourceType}
}

#[derive(Serialize, Deserialize)]
struct AttachInfo {
    attachedProcess: Process,
}

#[derive(Serialize, Deserialize)]
struct Breakpoint {
    function: Function,
    metadata: String
}

#[derive(Serialize, Deserialize)]
struct Variable {
    id: i32,
    name: String,
    v_type: String, //TODO: make this SourceType once that struct is defined
    address: i32,
    data: String,  //TODO: make this an object that has info related to variable
}
