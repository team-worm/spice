#[derive(Serialize, Deserialize)]
pub struct Error {
    /// Unique code identifying error type
    pub code: i32,
    /// Unique human readable name for error
    pub name: String,
    /// Unique human readable message for error
    pub message: String,
    // TODO: this needs to be another struct.  Data specific to error
    pub data: String,
}

#[derive(Serialize, Deserialize)]
pub struct File {
    /// Name of file
    pub name: String,
    /// Path to file
    pub path: String,
    /// File or directory
    pub fType: String,
    /// Vector of File objects
    pub contents: Vec<File>,
}

#[derive(Serialize, Deserialize)]
pub struct Process {
    /// Identifying number of process on host machine
    pub id: i32,
    /// Name of process on host machine
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Execution {
    /// Unique identifier
    pub id: i32,
    /// Type of execution.  Either 'function' or 'process'
    pub eType: String,
    /// Either `pending`, `executing`, `stopped`, or `done`
    pub status: String,
    /// Nanoseconds
    pub executionTime: i32,
    // TODO: this needs to be an object that contains data specific to this type
    pub data: String,
}

#[derive(Serialize, Deserialize)]
pub struct Trace {
    pub index: i32,
    pub tType: i32,
    pub line: i32,
    // TODO: needs to be an object that contains data specific to this type
    pub data: String,
}

#[derive(Serialize, Deserialize)]
pub struct Function {
    pub address: i32,
    pub name: String,
    pub sourcePath: String,
    pub lineNumber: i32,
    pub lineCount: i32,
    // TODO: make this an array of function parameter objects { name: string, type: SourceType }
    pub parameters: String,
}

#[derive(Serialize, Deserialize)]
pub struct AttachInfo {
    pub attachedProcess: Process,
}

#[derive(Serialize, Deserialize)]
pub struct Breakpoint {
    pub function: Function,
    pub metadata: String
}

#[derive(Serialize, Deserialize)]
pub struct Variable {
    pub id: i32,
    pub name: String,
    // TODO: make this SourceType once that struct is defined
    pub vType: String,
    pub address: i32,
    // TODO: make this an object that has info related to variable
    pub data: String,
}
