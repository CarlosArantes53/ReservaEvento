import json
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import threading
import time
from collections import deque

app = Flask(__name__)
socketio = SocketIO(app, async_mode="eventlet")

CONFIG_FILE = 'config_admin.json'

def load_config():
        with open(CONFIG_FILE, 'r') as file:
            return json.load(file)

def save_config(config):
    with open(CONFIG_FILE, 'w') as file:
        json.dump(config, file, indent=4)

config = load_config()
events = {event: {"vagas": info["vagas"], "reservas": {}} for event, info in config["events"].items()}
fila_espera = deque()
usuarios_interagindo = set()
lock = threading.Lock()
max_interacoes = config["max_interacoes"]

@app.route('/admin', methods=['GET'])
def admin():
    return render_template('admin.html', config=config)

@app.route('/admin/salvar', methods=['POST'])
def salvar_config():
    global config, events, max_interacoes
    data = request.json
    with lock:
        config = data
        save_config(config)
        events = {event: {"vagas": info["vagas"], "reservas": {}} for event, info in config["events"].items()}
        max_interacoes = config["max_interacoes"]
    return jsonify({"status": "Configuração salva com sucesso!"})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    with lock:
        return jsonify(events)

@socketio.on('entrar_fila')
def entrar_fila(data):
    with lock:
        user_id = data['user_id']
        if user_id not in fila_espera and user_id not in usuarios_interagindo:
            fila_espera.append(user_id)
            emitir_atualizacao_fila()

@socketio.on('reservar')
def reservar(data):
    with lock:
        user_id = data['user_id']
        evento = data['evento']
        if evento in events and user_id in usuarios_interagindo:
            if events[evento]['vagas'] > 0:
                events[evento]['vagas'] -= 1
                events[evento]['reservas'][user_id] = time.time()
                emitir_atualizacao_eventos()
                threading.Thread(target=timeout_reserva, args=(evento, user_id)).start()

def timeout_reserva(evento, user_id):
    time.sleep(120)
    with lock:
        if user_id in events[evento]['reservas']:
            del events[evento]['reservas'][user_id]
            events[evento]['vagas'] += 1
            emitir_atualizacao_eventos()

@socketio.on('confirmar_reserva')
def confirmar_reserva(data):
    with lock:
        user_id = data['user_id']
        evento = data['evento']
        if evento in events and user_id in events[evento]['reservas']:
            del events[evento]['reservas'][user_id]
            emitir_atualizacao_eventos()

@socketio.on('sair_fila')
def sair_fila(data):
    with lock:
        user_id = data['user_id']
        if user_id in fila_espera:
            fila_espera.remove(user_id)
            emitir_atualizacao_fila()

@socketio.on('liberar_interacao')
def liberar_interacao(data):
    with lock:
        if len(usuarios_interagindo) < max_interacoes and fila_espera:
            user_id = fila_espera.popleft()
            usuarios_interagindo.add(user_id)
            emitir_atualizacao_fila()

def emitir_atualizacao_eventos():
    socketio.emit('atualizar_eventos', events)

def emitir_atualizacao_fila():
    socketio.emit('atualizar_fila', list(fila_espera))

if __name__ == '__main__':
    socketio.run(app, debug=True)
