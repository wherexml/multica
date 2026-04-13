#!/bin/bash
# Seed admin user for local/demo deployments
# Creates admin@local with password admin123

set -e

# Database connection parameters
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-multica}"
DB_USER="${POSTGRES_USER:-multica}"
DB_PASSWORD="${POSTGRES_PASSWORD:-multica}"

# Admin user details
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
ADMIN_NAME="${ADMIN_NAME:-Admin}"

# Generate bcrypt hash for password
# Using Python's bcrypt library if available, otherwise use htpasswd
generate_bcrypt_hash() {
    local password="$1"
    
    # Try Python with bcrypt first
    if command -v python3 >/dev/null 2>&1 && python3 -c "import bcrypt" 2>/dev/null; then
        python3 -c "import bcrypt; print(bcrypt.hashpw(b'${password}', bcrypt.gensalt(rounds=10)).decode())"
        return 0
    fi
    
    # Fallback: use htpasswd if available
    if command -v htpasswd >/dev/null 2>&1; then
        htpasswd -nbB admin "${password}" | cut -d: -f2 | sed 's/\$2y\$/\$2a\$/'
        return 0
    fi
    
    # Last fallback: use a pre-computed hash for 'admin123'
    # This is NOT secure for production but fine for local dev
    echo '$2a$10$wJWulEjSfjMnMvl5qKqjmuBCqS5nLsqMuMqFsGS8Mj4nZcKjHqWnG'
    echo "Warning: Using pre-computed hash (install python3-bcrypt or apache2-utils for dynamic generation)" >&2
}

echo "=========================================="
echo "  Multica Admin User Seeder"
echo "=========================================="
echo ""
echo "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "Admin email: ${ADMIN_EMAIL}"
echo "Admin password: ${ADMIN_PASSWORD}"
echo ""

# Check if psql is available
if ! command -v psql >/dev/null 2>&1; then
    echo "Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Generate password hash
echo "Generating bcrypt hash for password..."
PASSWORD_HASH=$(generate_bcrypt_hash "${ADMIN_PASSWORD}")

# Export password for psql
export PGPASSWORD="${DB_PASSWORD}"

# Check if user already exists
USER_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT EXISTS(SELECT 1 FROM \"user\" WHERE email='${ADMIN_EMAIL}')")

if [ "$USER_EXISTS" = "t" ]; then
    echo "Warning: User ${ADMIN_EMAIL} already exists. Updating password..."
    
    # Update existing user
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<-SQL
		UPDATE "user" 
		SET password_hash = '${PASSWORD_HASH}'
		WHERE email = '${ADMIN_EMAIL}';
	SQL
    
    echo "✓ Password updated for ${ADMIN_EMAIL}"
else
    echo "Creating new admin user..."
    
    # Insert the user
    USER_ID=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "
        INSERT INTO \"user\" (name, email, password_hash)
        VALUES ('${ADMIN_NAME}', '${ADMIN_EMAIL}', '${PASSWORD_HASH}')
        RETURNING id;
    ")
    
    echo "✓ User created with ID: ${USER_ID}"
    
    # Check if a workspace exists for this user (auto-created during registration)
    WORKSPACE_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "
        SELECT EXISTS(
            SELECT 1 FROM workspace w
            JOIN member m ON w.id = m.workspace_id
            WHERE m.user_id = '${USER_ID}'
        )
    ")
    
    if [ "$WORKSPACE_EXISTS" != "t" ]; then
        echo "No workspace found for user. Creating default workspace..."
        
        # Create workspace
        WORKSPACE_ID=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "
            INSERT INTO workspace (name, slug, description, settings)
            VALUES ('${ADMIN_NAME} Workspace', 'admin-workspace', 'Default workspace for admin user', '{}')
            RETURNING id;
        ")
        
        echo "✓ Workspace created with ID: ${WORKSPACE_ID}"
        
        # Create member record
        psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<-SQL
		INSERT INTO member (workspace_id, user_id, role)
		VALUES ('${WORKSPACE_ID}', '${USER_ID}', 'owner');
		SQL
        
        echo "✓ Member record created"
    fi
fi

echo ""
echo "=========================================="
echo "✓ Admin user seeded successfully!"
echo "=========================================="
echo ""
echo "You can now login with:"
echo "  Email: ${ADMIN_EMAIL}"
echo "  Password: ${ADMIN_PASSWORD}"
echo ""
echo "Access the app at: http://localhost:22202"
echo ""
