extern crate hyper;
extern crate reroute;
extern crate serde;
extern crate serde_json;

//structs found in /serde_types.in.rs
//need this line to make serialization of structs work.
include!(concat!(env!("OUT_DIR"), "/serde_types.rs"));

use std::*;
use hyper::server::{Server, Request, Response};
use hyper::status::StatusCode;
use reroute::{Captures, Router};

//static VERSION : &'static str = "/api/v1/";

//REST ENDPOINTS
static FILE_SYS_END_PT : &'static str = r"/api/v1/filesystem/[[:ascii:]]*";
static PROCESS_END_PT : &'static str = "/api/v1/processes/";
static DEBUG_ATCH_PID_END_PT : &'static str = r"/api/v1/debug/attach/pid/[[:digit:]]*";
static DEBUG_ATCH_BIN_END_PT : &'static str = r"/api/v1/debug/attach/bin/[[:ascii:]]*";
static DEBUG_END_PT : &'static str = "/api/v1/debug";
static DEBUG_FUNC_LST_END_PT : &'static str = "/api/v1/debug/functions";
static DEBUG_FUNC_END_PT : &'static str = r"/api/v1/debug/functions/[[:ascii:]]*";
static BRKPNT_END_PT : &'static str = "/api/v1/debug/breakpoints";
static FUNC_BRKPNT_END_PT : &'static str = r"/api/v1/debug/breakpoints/[[:ascii:]]*"; //PUT AND DELETE
static DEBUG_EXEC_PROC_END_PT : &'static str = "/api/v1/debug/execute";
static DEBUG_EXEC_FUNC_END_PT : &'static str = r"/api/v1/debug/functions/[[:ascii:]]*/execute";

static DEBUG_EXEC_LST_END_PT : &'static str = "/api/v1/debug/executions";
static DEBUG_EXEC_STATUS_END_PT : &'static str = r"/api/v1/debug/executions/[[:digit:]]*";
static DEBUG_EXEC_TRACE_END_PT : &'static str = r"/api/v1/debug/executions/[[:digit:]]*/trace";
static DEBUG_EXEC_STOP_END_PT : &'static str = r"/api/v1/debug/executions/[[:digit:]]*/stop";

// @ /greet
fn basic_handler(_: Request, res: Response, c: Captures){
    println!("captures: {:?}", c);
    res.send(b"He who controls the spice...").unwrap();
}

// @ /filesystem/:path*
fn filesystem_handler(_: Request, res: Response, c: Captures){
    println!("file system captures captures: {:?}", c); //debug line

    let c_str = &c.unwrap()[0];
    
    println!{"c_str value: {}", c_str}; //debug line
    
    let path = c_str.split("/api/v1/filesystem").nth(1).unwrap();

    println!("path value: {}", path);// debug line
    
    let file_meta = fs::metadata(path).unwrap();

    let mut file_type = "".to_string();

    if file_meta.is_dir(){
        file_type = "dir".to_string();
    } else{
        file_type = "file".to_string();
    }

    let my_file = File{name: path.to_string(), path: path.to_string(), f_type: file_type, contents: "Hello World".to_string()};

    let json_str = serde_json::to_string(&my_file).unwrap();

    res.send(&json_str.into_bytes()).unwrap();
}

// @ /processes
fn process_handler(_: Request, res: Response, c: Captures){
    println!("captures: {:?}", c);
    res.send(b"Here are the processes").unwrap();
}

// @ /debug/attach/pid/:pid
fn attach_pid_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}


// @ /debug/attach/bin/:function
fn attach_bin_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn debug_info_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn debug_list_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn function_info_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn list_breakpoints_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn set_breakpoint_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn del_breakpoint_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn launch_process_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn exec_func_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn list_execs_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn exec_status_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn exec_trace_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}

// @ /debug/attach/bin/:function
fn stop_exec_handler(_:Request, res: Response, c: Captures){
    res.send(b"He who controls the spice...").unwrap();
}


fn main() {
    //install routes
    
    let mut router = Router::new();
    router.get("/greet", basic_handler); // debug line
    

    router.get(FILE_SYS_END_PT, filesystem_handler);
    router.get(PROCESS_END_PT, process_handler);
    router.post(DEBUG_ATCH_PID_END_PT, attach_pid_handler);
    router.post(DEBUG_ATCH_BIN_END_PT, attach_bin_handler);
    router.get(DEBUG_END_PT, debug_info_handler);
    router.get(DEBUG_FUNC_LST_END_PT, debug_list_handler);
    router.get(DEBUG_FUNC_END_PT, function_info_handler);
    router.get(BRKPNT_END_PT, list_breakpoints_handler);
    router.put(FUNC_BRKPNT_END_PT, set_breakpoint_handler);
    router.delete(FUNC_BRKPNT_END_PT, del_breakpoint_handler);
    router.post(DEBUG_EXEC_PROC_END_PT, launch_process_handler);
    router.post(DEBUG_EXEC_FUNC_END_PT, exec_func_handler);
    router.get(DEBUG_EXEC_LST_END_PT, list_execs_handler);
    router.get(DEBUG_EXEC_STATUS_END_PT, exec_status_handler);
    router.get(DEBUG_EXEC_TRACE_END_PT, exec_trace_handler);
    router.post(DEBUG_EXEC_STOP_END_PT, stop_exec_handler);
    
    
    router.finalize().unwrap();

    let server = Server::http("127.0.0.1:3000").unwrap();
    server.handle(router).unwrap();
}
