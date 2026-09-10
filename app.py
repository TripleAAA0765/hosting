import pymysql
from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask import jsonify

app = Flask(__name__)
app.secret_key = "buscaminas_secret_key_2026"

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "mysql",
    "database": "minagame",
    "cursorclass": pymysql.cursors.DictCursor,
}

levels = {
    "beginner": {"label": "Fácil", "rows": 8, "cols": 8, "mines": 10},
    "intermediate": {"label": "Medio", "rows": 12, "cols": 12, "mines": 28},
    "expert": {"label": "Difícil", "rows": 16, "cols": 16, "mines": 44}
}


def get_db_connection():
    return pymysql.connect(**DB_CONFIG)


@app.route("/")
def index():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT nombre, puntaje, fecha_creacion
                FROM usuarios
                WHERE fecha_creacion >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)
                ORDER BY puntaje DESC
                LIMIT 10
            """)
            weekly = cur.fetchall()

            cur.execute("""
                SELECT nombre, puntaje, fecha_creacion
                FROM usuarios
                ORDER BY puntaje DESC
                LIMIT 10
            """)
            global_top = cur.fetchall()
    finally:
        conn.close()

    return render_template(
        "index.html",
        user=session.get("name"),
        rankings_weekly=weekly,
        rankings_global=global_top
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM usuarios WHERE gmail = %s", (email,))
                user = cur.fetchone()
        finally:
            conn.close()

        if user and user["password"] == password:
            session["logged_in"] = True
            session["name"] = user["nombre"]
            session["email"] = user["gmail"]
            flash("Bienvenido de nuevo", "success")
            return redirect(url_for("index"))
        else:
            flash("Correo o contraseña incorrectos", "error")

    return render_template("login.html")


@app.route("/api/score", methods=["POST"])
def save_score():
    if not session.get("logged_in"):
        return jsonify({"ok": False, "message": "Sin sesión"}), 401

    try:
        payload = request.get_json()
    except Exception:
        payload = {}

    if not payload:
        return jsonify({"ok": False, "message": "Sin datos"}), 400

    level = payload.get("level", "beginner")
    seconds = int(payload.get("seconds", 0))
    if level not in levels:
        return jsonify({"ok": False, "message": "Nivel inválido"}), 400

    if seconds <= 0:
        seconds = 1

    multiplier = {"beginner": 1, "intermediate": 2, "expert": 3}
    base_score = max(100, 1000 - (seconds * 10))
    score = base_score * multiplier.get(level, 1)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE usuarios SET puntaje = %s WHERE gmail = %s", (score, session.get("email")))
        conn.commit()
    finally:
        conn.close()

    return jsonify({"ok": True, "score": score, "seconds": seconds})


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not name:
            flash("El nombre es obligatorio", "error")
        elif not email.endswith("@gmail.com"):
            flash("Debes usar un correo Gmail válido", "error")
        elif "@" not in email:
            flash("Correo inválido", "error")
        elif len(password) < 6:
            flash("La contraseña debe tener al menos 6 caracteres", "error")
        elif password != confirm_password:
            flash("Las contraseñas no coinciden", "error")
        else:
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM usuarios WHERE gmail = %s", (email,))
                    existing = cur.fetchone()
                    if existing:
                        flash("Este correo ya está registrado", "error")
                        return render_template("register.html")

                    cur.execute("INSERT INTO usuarios(nombre, gmail, password, puntaje) VALUES (%s, %s, %s, 0)", (name, email, password))
                conn.commit()
            finally:
                conn.close()
            flash("Registro correcto. Ahora inicia sesión", "success")
            return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/api/levels")
def api_levels():
    return jsonify(levels)


if __name__ == "__main__":
    app.run(debug=True)
