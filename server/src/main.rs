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

static PROCESS_END_PT : &'static str = "/api/v1/processes/";
static FILE_SYS_END_PT : &'static str = r"/api/v1/filesystem/[[:ascii:]]*";
static DEBUG_ATTACH_PID_END_PT : &'static str = r"/api/v1/debug/attach/pid/[[:digit:]]*";
static DEBUG_ATTACH_BIN_END_PT : &'static str = r"/api/v1/debug/attach/bin/[[:ascii:]]*";
static DEBUG_END_PT : &'static str = "/api/v1/debug";
static DEBUG_FUNCTIONS_END_PT : &'static str = r"/api/v1/debug/functions/[[:ascii:]]*";
static BREAKPOINTS_END_PT : &'static str = "/api/v1/debug/breakpoints";
static FUNC_BREAKPOINTS_END_PT : &'static str = r"/api/v1/debug/breakpoints/[[:ascii:]]";
static DEBUG_EXEC_END_PT : &'static str = "/api/v1/debug/execute";

// @ /greet
fn basic_handler(_: Request, res: Response, c: Captures){
    println!("captures: {:?}", c);
    res.send(b"He who controls the spice...").unwrap();
}

// @ /api/v1/filesystem/:path*
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


fn main() {
    //install routes
    
    let mut router = Router::new();

    //host system info routes
    router.get("/greet", basic_handler);
    router.get(PROCESS_END_PT, process_handler);
    router.get(FILE_SYS_END_PT, filesystem_handler);

    //debug routes


    
    router.finalize().unwrap();

    let server = Server::http("127.0.0.1:3000").unwrap();
    server.handle(router).unwrap();
}
