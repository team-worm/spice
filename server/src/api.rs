use serde_json::Value;

#[derive(Deserialize)]
pub struct Launch {
    /// Command line arguments
    pub args: String,
    /// Environment variables
    pub env: String,
}

#[derive(Deserialize)]
pub struct Call {
    // TODO: convert this to typed values
    pub parameters: Vec<i32>,
}

#[derive(Serialize, Deserialize)]
pub struct Error {
    /// Unique code identifying error type
    pub code: i32,
    /// Unique human readable message for error
    pub message: String,
    // TODO: this needs to be another struct.  Data specific to error
    pub data: i32,
}

#[derive(Serialize, Deserialize)]
pub struct File {
    /// Name of file
    pub name: String,
    /// Path to file
    pub path: String,
    /// File or directory
    #[serde(rename = "fType")]
    pub f_type: String,
    /// Vector of File objects
    pub contents: Vec<File>,
}

#[derive(Serialize, Deserialize)]
pub struct Process {
    /// Identifying number of process on host machine
    pub id: u32,
    /// Name of process on host machine
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Execution {
    /// Unique identifier
    pub id: i32,
    /// Type of execution.  Either 'function' or 'process'
    #[serde(rename = "eType")]
    pub e_type: String,
    /// Either `pending`, `executing`, `stopped`, or `done`
    pub status: String,
    /// Nanoseconds
    #[serde(rename = "executionTime")]
    pub execution_time: i32,
    /// Function or next execution
    pub data: Option<ExecutionData>,
}

#[derive(Serialize, Deserialize)]
pub struct ExecutionData {
    #[serde(rename = "nextExecution")]
    pub next_execution: i32,
}

#[derive(Serialize, Deserialize)]
pub struct Trace {
    pub index: i32,
    #[serde(rename = "tType")]
    pub t_type: i32,
    pub line: u32,
    pub data: Value,
}

#[derive(Serialize, Deserialize)]
pub struct TraceData {
    pub state: Vec<TraceState>,
}

#[derive(Serialize, Deserialize)]
pub struct TraceState {
    #[serde(rename = "sVariable")]
    pub variable: String,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct Function {
    pub address: usize,
    pub name: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "lineNumber")]
    pub line_number: i32,
    #[serde(rename = "lineCount")]
    pub line_count: i32,
    pub parameters: Vec<Variable>,
    #[serde(rename = "localVariables")]
    pub local_variables: Vec<Variable>,
}

#[derive(Serialize, Deserialize)]
pub struct DebugInfo {
    pub id: i32,
    #[serde(rename = "attachedProcess")]
    pub attached_process: Process,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct Breakpoint {
    #[serde(rename = "sFunction")]
    pub function: usize,
    pub metadata: String
}

#[derive(Serialize, Deserialize)]
pub struct Variable {
    pub id: i32,
    pub name: String,
    #[serde(rename = "sType")]
    pub s_type: SourceType,
    pub address: usize,
}

pub type SourceType = String;
