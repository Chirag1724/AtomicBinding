import socket
import threading

HOST = '127.0.0.1'  
PORT = 1234 
MAX_CONNECTIONS = 5  
clients = []  


def handle_client_messages(client, username):
    while True:
        message = client.recv(2048).decode('utf-8')
        if message:
            message_with_username = f"{username}~{message}"
            broadcast_message(message_with_username)
        else:
            print(f"Received empty message from {username}")


def send_to_client(client, message):
    client.sendall(message.encode('utf-8'))

def broadcast_message(message):
    for _, client in clients:
        send_to_client(client, message)


def manage_client(client):
    while True:
        username = client.recv(2048).decode('utf-8')
        if username:
            clients.append((username, client))
            notification = f"SERVER~ {username} has joined the chat."
            broadcast_message(notification)
            break
        else:
            print("Client sent an empty username.")

    threading.Thread(target=handle_client_messages, args=(client, username)).start()


def start_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM) 

    try:
        server.bind((HOST, PORT))  
        print(f"Server running at {HOST}:{PORT}")
    except Exception as e:
        print(f"Error binding server: {e}")
        return

    server.listen(MAX_CONNECTIONS) 


    while True:
        client, address = server.accept()
        print(f"New client connected: {address[0]}:{address[1]}")
        threading.Thread(target=manage_client, args=(client,)).start()

if __name__ == '__main__':
    start_server()
