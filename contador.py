import json

with open('perguntas.json', 'r', encoding='utf-8') as perguntasJson:
    data = json.load(perguntasJson)

totalPerguntas = len(data)

print(f"Total: {totalPerguntas}")