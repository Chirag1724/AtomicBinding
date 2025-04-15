import socket
import threading
import tkinter as tk
from tkinter import scrolledtext
from tkinter import messagebox

HOST = '127.0.0.1'
PORT = 1234

DARK_GREY = '#121212'
MEDIUM_GREY = '#1F1B24'
OCEAN_BLUE = '#464EB8'
WHITE = "white"
FONT = ("Helvetica", 17)
BUTTON_FONT = ("Helvetica", 15)
SMALL_FONT = ("Helvetica", 13)

client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

def display_message(message):
    message_area.config(state=tk.NORMAL)
    message_area.insert(tk.END, message + '\n')
    message_area.config(state=tk.DISABLED)

def establish_connection():
    try:
        client_socket.connect((HOST, PORT))
        print("Successfully connected to the server.")
        display_message("[SERVER] Connection successful")
    except:
        messagebox.showerror("Connection Error", f"Could not connect to {HOST} on port {PORT}")

    username = username_entry.get()
    if username:
        client_socket.sendall(username.encode())
    else:
        messagebox.showerror("Invalid Username", "Username cannot be empty.")

    threading.Thread(target=receive_server_messages, args=(client_socket,)).start()

    username_entry.config(state=tk.DISABLED)
    join_button.config(state=tk.DISABLED)

def send_chat_message():
    message = message_entry.get()
    if message:
        client_socket.sendall(message.encode())
        message_entry.delete(0, tk.END)
    else:
        messagebox.showerror("Empty Message", "Please type a message before sending.")

window = tk.Tk()
window.geometry("600x600")
window.title("Messenger Client")
window.resizable(False, False)

window.grid_rowconfigure(0, weight=1)
window.grid_rowconfigure(1, weight=4)
window.grid_rowconfigure(2, weight=1)

top_frame = tk.Frame(window, width=600, height=100, bg=DARK_GREY)
top_frame.grid(row=0, column=0, sticky=tk.NSEW)

middle_frame = tk.Frame(window, width=600, height=400, bg=MEDIUM_GREY)
middle_frame.grid(row=1, column=0, sticky=tk.NSEW)

bottom_frame = tk.Frame(window, width=600, height=100, bg=DARK_GREY)
bottom_frame.grid(row=2, column=0, sticky=tk.NSEW)

username_label = tk.Label(top_frame, text="Enter your username:", font=FONT, bg=DARK_GREY, fg=WHITE)
username_label.pack(side=tk.LEFT, padx=10)

username_entry = tk.Entry(top_frame, font=FONT, bg=MEDIUM_GREY, fg=WHITE, width=23)
username_entry.pack(side=tk.LEFT)

join_button = tk.Button(top_frame, text="Join", font=BUTTON_FONT, bg=OCEAN_BLUE, fg=WHITE, command=establish_connection)
join_button.pack(side=tk.LEFT, padx=15)

message_entry = tk.Entry(bottom_frame, font=FONT, bg=MEDIUM_GREY, fg=WHITE, width=38)
message_entry.pack(side=tk.LEFT, padx=10)

send_button = tk.Button(bottom_frame, text="Send", font=BUTTON_FONT, bg=OCEAN_BLUE, fg=WHITE, command=send_chat_message)
send_button.pack(side=tk.LEFT, padx=10)

message_area = scrolledtext.ScrolledText(middle_frame, font=SMALL_FONT, bg=MEDIUM_GREY, fg=WHITE, width=67, height=26.5)
message_area.config(state=tk.DISABLED)
message_area.pack(side=tk.TOP)

def receive_server_messages(client_socket):
    while True:
        message = client_socket.recv(2048).decode('utf-8')
        if message:
            username, chat_message = message.split("~", 1)
            display_message(f"[{username}] {chat_message}")
        else:
            messagebox.showerror("Message Error", "Received empty message from the server.")

def start_client():
    window.mainloop()

if __name__ == '__main__':
    start_client()
