import json
import threading
import time
from collections import deque

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO

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

@app.route('/api/user_id', methods=['GET'])
def get_user_id():
    return jsonify({'user_id': request.sid})

usuarios_online = set()

@socketio.on('connect')
def conectar():
    user_id = request.sid
    socketio.emit('user_id', {'user_id': user_id})
    usuarios_online.add(user_id)
    emitir_atualizacao_usuarios_online()


@socketio.on('disconnect')
def desconectar():
    if request.sid in usuarios_online:
        usuarios_online.remove(request.sid)
    emitir_atualizacao_usuarios_online()

def emitir_atualizacao_usuarios_online():
    socketio.emit('atualizar_usuarios_online', list(usuarios_online))

def check_user_activity():
    while True:
        time.sleep(1)
        emitir_atualizacao_usuarios_online()

def start_periodic_check():
    thread = threading.Thread(target=check_user_activity)
    thread.daemon = True
    thread.start()

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
            else:
                socketio.emit('erro', {'mensagem': 'Vagas esgotadas para este evento!'})

@socketio.on('tempo_fila')
def monitorar_tempo_fila(data):
    with lock:
        user_id = data['user_id']
        tempo_inicio = time.time()
        while user_id in fila_espera:
            if time.time() - tempo_inicio > 30:
                fila_espera.remove(user_id)
                fila_espera.append(user_id)
                emitir_atualizacao_fila()
                break

def liberar_proxima_interacao():
    with lock:
        if len(usuarios_interagindo) < max_interacoes and fila_espera:
            user_id = fila_espera.popleft()
            usuarios_interagindo.add(user_id)
            socketio.emit('interacao_liberada', {'user_id': user_id})
            emitir_atualizacao_fila()

@socketio.on('liberar_vaga')
def liberar_vaga(data):
    with lock:
        evento = data['evento']
        user_id = data['user_id']
        if evento in events and user_id in events[evento]['reservas']:
            del events[evento]['reservas'][user_id]
            events[evento]['vagas'] += 1
            emitir_atualizacao_eventos()
        liberar_proxima_interacao()
        
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
    start_periodic_check()
    socketio.run(app, debug=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)