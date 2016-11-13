extern crate hyper;
extern crate reroute;

use hyper::server::{Server, Request, Response};
use hyper::status::StatusCode;
use reroute::{Captures, Router};

fn basic_handler(req: Request, res: Response, c: Captures){
    res.send(b"Hello World").unwrap();
}

fn filesystem_handler(req: Request, res: Response, c: Captures){
    println!("captures: {:?}", c);
    res.send(b"Here are the files at root").unwrap();
}

fn main() {
    //install routes
    
    let mut router = Router::new();
    router.get("/greet", basic_handler);
    router.get(r"/api/v1/filesystem/*", filesystem_handler);
    
    router.finalize().unwrap();

    let server = Server::http("127.0.0.1:3000").unwrap();
    server.handle(router).unwrap();
}
