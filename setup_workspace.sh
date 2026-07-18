#!/bin/bash

# Encerra o script imediatamente se qualquer comando falhar
set -e

echo "=============================================================================="
echo "🚀 Iniciando a construção do workspace seguro..."
echo "=============================================================================="

# 1. Checagem de Pré-requisitos (Fail-fast)
echo "🔍 Verificando pré-requisitos do sistema (Ubuntu)..."

if ! command -v git &> /dev/null; then
    echo "❌ Erro: Git não encontrado. Instale com: sudo apt install git"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Erro: Python3 não encontrado. Instale com: sudo apt install python3"
    exit 1
fi

# Testa se o módulo venv do Python está disponível
if ! python3 -m venv --help &> /dev/null; then
    echo "❌ Erro: Pacote venv do Python não encontrado!"
    echo "No Ubuntu, instale executando: sudo apt install python3-venv"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Erro: NPM não encontrado. Instale o Node.js: sudo apt install npm"
    exit 1
fi

echo "✅ Todos os pré-requisitos foram atendidos!"
echo "------------------------------------------------------------------------------"

# 2. Inicializa o repositório Git
if [ ! -d ".git" ]; then
    echo "📦 Inicializando Git..."
    git init
else
    echo "⚡ Git já inicializado."
fi

# 3. Criação da Estrutura do Backend
echo "📁 Criando estrutura do Backend..."
mkdir -p backend/app/{api,core,models,services,adapters,temp_audio}
mkdir -p backend/tests

# 4. Criando Ambiente Virtual Python (venv)
if [ ! -d "backend/venv" ]; then
    echo "🐍 Criando ambiente virtual Python..."
    python3 -m venv backend/venv
else
    echo "⚡ venv já existe."
fi

# 5. Criando arquivos base do Backend
touch backend/app/__init__.py
touch backend/app/main.py
touch backend/requirements.txt
touch backend/.env

# 6. Inicializando Frontend (PWA com React)
if [ ! -d "frontend" ]; then
    echo "⚛️ Criando Frontend (React + Vite)..."
    npm create vite@latest frontend -- --template react
else
    echo "⚡ Pasta frontend já existe."
fi

# 7. Configurando .gitignore rigoroso
echo "🙈 Gerando .gitignore..."
cat <<EOF > .gitignore
# Ambientes Python
backend/venv/
__pycache__/
*.pyc
.pytest_cache/

# Configurações e Segredos
backend/.env

# Arquivos Temporários de Áudio (Segurança/LGPD)
backend/app/temp_audio/*
!backend/app/temp_audio/.keep

# Frontend e Node
node_modules/
frontend/dist/
frontend/node_modules/
.DS_Store
EOF

# Cria um arquivo .keep vazio para que a pasta temp_audio vá para o Git, mas sem os áudios
touch backend/app/temp_audio/.keep

echo "=============================================================================="
echo "🎉 Workspace criado com sucesso e segurança!"
echo "=============================================================================="
