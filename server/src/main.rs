extern crate hyper;
extern crate reroute;
extern crate serde;
extern crate serde_json;

use std::{fs, io};
use std::io::BufRead;
use hyper::server::{Server, Request, Response};
use reroute::{Captures, Router};

use serde_types::*;

mod serde_types {
    #![allow(non_snake_case)]

    include!(concat!(env!("OUT_DIR"), "/serde_types.rs"));
}

//static VERSION : &'static str = "/api/v1/";

//REST ENDPOINTS
static FILE_SYS_END_PT: &'static str = r"/api/v1/filesystem/[[:ascii:]]*";
static PROCESS_END_PT: &'static str = "/api/v1/processes";
static DEBUG_ATCH_PID_END_PT: &'static str = r"/api/v1/debug/attach/pid/[[:digit:]]*";
static DEBUG_ATCH_BIN_END_PT: &'static str = r"/api/v1/debug/attach/bin/[[:ascii:]]*";
static DEBUG_END_PT: &'static str = "/api/v1/debug";
static DEBUG_FUNC_LST_END_PT: &'static str = "/api/v1/debug/functions";
static DEBUG_FUNC_END_PT: &'static str = r"/api/v1/debug/functions/[[:ascii:]]*";
static BRKPNT_END_PT: &'static str = "/api/v1/debug/breakpoints";
static FUNC_BRKPNT_END_PT: &'static str = r"/api/v1/debug/breakpoints/[[:ascii:]]*"; //PUT AND DELETE
static DEBUG_EXEC_PROC_END_PT: &'static str = "/api/v1/debug/execute";
static DEBUG_EXEC_FUNC_END_PT: &'static str = r"/api/v1/debug/functions/[[:ascii:]]*/execute";

static DEBUG_EXEC_LST_END_PT: &'static str = "/api/v1/debug/executions";
static DEBUG_EXEC_STATUS_END_PT: &'static str = r"/api/v1/debug/executions/[[:digit:]]*";
static DEBUG_EXEC_TRACE_END_PT: &'static str = r"/api/v1/debug/executions/[[:digit:]]*/trace";
static DEBUG_EXEC_STOP_END_PT: &'static str = r"/api/v1/debug/executions/[[:digit:]]*/stop";

/// @ /greet
fn basic_handler(_: Request, res: Response, c: Captures) {
    println!("captures: {:?}", c);
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /filesystem/:path* -- return a list of files given a directory path
fn filesystem_handler(_: Request, res: Response, c: Captures) {
    let c_str = &c.unwrap()[0];

    let path = c_str.split("/api/v1/filesystem").nth(1).unwrap().to_string();

    let file_meta = fs::metadata(path).unwrap();

    let file_type; 

    let mut contents = vec![];
    if file_meta.is_dir() {
        file_type = "dir".to_string();
        let paths = fs::read_dir(path).unwrap();

        for path in paths {
            let dir_entry = path.unwrap();
            let child_file_type; 

            if dir_entry.file_type().unwrap().is_dir() {
                child_file_type = "dir".to_string();
            } else {
                child_file_type = "file".to_string();
            }


            dir_content.push(File {
                name: dir_entry.file_name().into_string().unwrap(),
                path: dir_entry.path().into_os_string().into_string().unwrap(),
                fType: child_file_type,
                contents: Vec::<File>::new()
            });

        } // end dir content iterator
    } else {
        file_type = "file".to_string();
    }

    let my_file = File { name: path, path, fType: file_type, contents };

    let json_str = serde_json::to_string(&my_file).unwrap();

    res.send(&json_str.into_bytes()).unwrap();
}

/// @ /processes -- list the currently running processes on the host machine
/// This assumes running on linux
fn process_handler(_: Request, res: Response, c: Captures) {
    println!("captures: {:?}", c);

    let curr_procs = read_proc_dir();

    let json_str = serde_json::to_string(&curr_procs).unwrap();
    res.send(&json_str.into_bytes()).unwrap();
}

/// helper function to recursively go through /proc directory
fn read_proc_dir() -> Vec<Process> {
    let mut processes = Vec::<Process>::new();
    let paths = fs::read_dir("/proc").unwrap();

    for path in paths {
        let dir_entry = path.unwrap();
        let f_name = dir_entry.file_name().into_string().unwrap();
        let mut path_name = dir_entry.path().into_os_string().into_string().unwrap();

        if dir_entry.metadata().unwrap().is_dir()
            && !f_name.parse::<i32>().is_err() {

                path_name.push_str("/status");
                println!("stat path is: {}", f_name);// debug line
                let proc_stats = fs::File::open(path_name).unwrap();
                let reader = io::BufReader::new(proc_stats);

                let mut p_name = "".to_string();
                let mut p_id = "".to_string();

                for line in reader.lines() {
                    let l = line.unwrap();
                    if l.starts_with("Name:") {
                        p_name = l.split("Name:").nth(1).unwrap().trim().to_string();
                    } else if l.starts_with("Pid") {
                        p_id = l.split("Pid:").nth(1).unwrap().trim().to_string();
                    }

                    if !p_name.is_empty() && !p_id.is_empty() {
                        processes.push(Process {
                            id: p_id.parse::<i32>().unwrap(), name: p_name.to_string()
                        });
                        break;
                    }


                } // end reading lines of status file                
            }
    } //end iteration over dirs in proc

    //return processes
    processes
}

/// @ /debug/attach/pid/:pid -- attach to currently running process by pid
fn attach_pid_handler(_:Request, res: Response, c: Captures) {
    let c_str = &c.unwrap()[0];
    let pid = c_str.split("/api/v1/debug/attach/pid/").nth(1).unwrap();

    let mut debug_str = "You attached to pid ".to_string();
    debug_str.push_str(pid);
    res.send(debug_str.as_bytes()).unwrap(); //TODO:  really attach to pid returns AttachInfo struct
    // whichh has yet to be defined.
}


/// @ /debug/attach/bin/:path -- attach to a binary that resides at :path
fn attach_bin_handler(_:Request, res: Response, c: Captures) {
    let c_str = &c.unwrap()[0];

    let path = c_str.split("/api/v1/debug/attach/bin/").nth(1).unwrap(); //TODO

    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug
fn debug_info_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/functions
fn debug_list_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/functions/:function
fn function_info_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/breakpoints
fn list_breakpoints_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/breakpoints/:function -- Sets a breakpoint on given function
fn set_breakpoint_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/breakpoints/:function -- Deletes a breakpoint
fn del_breakpoint_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/execute -- Launches process if not running.  Continues otherwise
fn launch_process_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/functions/:function/execute -- executes function with parameters in POST body
fn exec_func_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions -- returns list of executions 
fn list_execs_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions/:executionId -- get information about execution status
fn exec_status_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions/executionId/trace -- Get trace data for execution
fn exec_trace_handler(_:Request, res: Response, c: Captures) {
    res.send(b"He who controls the spice...").unwrap();
}

/// @ /debug/executions/:executionId/stop -- Halts a running execution
fn stop_exec_handler(_:Request, res: Response, c: Captures) {
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
