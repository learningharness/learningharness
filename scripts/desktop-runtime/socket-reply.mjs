// Socket.end returns a Socket, not a Promise. Keep request errors contained.
export async function replyToSocket(socket,work){
 let response;
 try{response={result:await work()};}catch(error){response={error:error.message};}
 if(!socket.destroyed)socket.end(JSON.stringify(response));
}
