#[derive(Serialize, Deserialize)]
struct Error {
    ///unique code identifying error type
    code: i32,
    ///Unique human readable name for error
    name: String,
    ///Unique human readable message for error
    message: String,
    ///TODO:  this needs to be another struct.  Data specific to error
    data: String, 
}

#[derive(Serialize, Deserialize)]
struct File {
    ///Name of file
    name: String,
    ///Path to file
    path: String,
    ///file or directory
    f_type: String, 
    ///Contents of a directory
    contents: Vec<File>, 
}

#[derive(Serialize, Deserialize)]
struct Process {
    ///Identifying number of process on host machine
    id: i32,
    ///Name of process on host machine
    name: String, 
}

#[derive(Serialize, Deserialize)]
struct Execution {
    ///Unique identifier
    id: i32,
    ///type of execution.  Either 'function' or 'process'
    e_type: String,
    /// Either `pending`, `executing`, `stopped`, or `done`
    status: String,
    ///nanoseconds
    executionTime: i32,
    ///TODO:  this needs to be an object that contains data specific to this type
    data: String, 
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
