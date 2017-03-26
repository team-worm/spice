use std::collections::HashMap;

#[derive(Deserialize)]
pub struct Launch {
    /// Command line arguments
    pub args: String,
    /// Environment variables
    pub env: String,
}

#[derive(Deserialize)]
pub struct Call {
    pub arguments: HashMap<usize, Value>,
}

#[derive(Serialize)]
pub struct Process {
    pub id: u32,
    pub name: String,
}

#[derive(Serialize)]
pub struct File {
    pub name: String,
    pub path: String,
    pub data: FileData,
}

#[derive(Serialize)]
#[serde(tag = "fType")]
pub enum FileData {
    #[serde(rename = "file")]
    File,
    #[serde(rename = "directory")]
    Directory { contents: Option<Vec<File>> },
}

#[derive(Serialize)]
pub struct DebugInfo {
    pub id: i32,
    #[serde(rename = "attachedProcess")]
    pub attached_process: Process,
}

#[derive(Serialize)]
pub struct Function {
    pub address: usize,
    pub name: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "lineStart")]
    pub line_start: u32,
    #[serde(rename = "lineCount")]
    pub line_count: u32,
    pub parameters: Vec<Variable>,
    pub locals: Vec<Variable>,
}

#[derive(Serialize)]
pub struct Variable {
    pub name: String,
    #[serde(rename = "sType")]
    pub type_index: u32,
    pub address: usize,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Null,
    Boolean(bool),
    Integer(i64),
    Number(f64),
    Array(Vec<Value>),
    Struct(HashMap<u32, Value>),
}

#[derive(Serialize)]
pub struct Breakpoint {
    #[serde(rename = "sFunction")]
    pub function: usize,
}

#[derive(Serialize)]
pub struct Execution {
    pub id: i32,
    pub data: ExecutionData,
}

#[derive(Serialize)]
#[serde(tag = "eType")]
pub enum ExecutionData {
    #[serde(rename = "process")]
    Process,
    #[serde(rename = "function")]
    Function {
        #[serde(rename = "sFunction")]
        function: usize
    },
}

#[derive(Serialize)]
pub struct Trace {
    pub index: i32,
    pub line: u32,
    pub data: TraceData,
}

#[derive(Serialize)]
#[serde(tag = "tType")]
pub enum TraceData {
    #[serde(rename = "line")]
    Line { state: HashMap<usize, Value> },
    #[serde(rename = "call")]
    Call {
        #[serde(rename = "sFunction")]
        function: usize,
    },
    #[serde(rename = "return")]
    Return { value: Value, data: HashMap<usize, Value> },
    #[serde(rename = "break")]
    Break {
        #[serde(rename = "nextExecution")]
        next_execution: i32,
    },
    #[serde(rename = "exit")]
    Exit { code: u32 },
    #[serde(rename = "cancel")]
    Cancel,
    #[serde(rename = "crash")]
    Crash { stack: String },
    #[serde(rename = "error")]
    Error { error: Error },
}

#[derive(Serialize)]
pub struct Error {
    pub message: String,
}
