"""
Crear modelo de ejemplo con Iris Dataset
Este script crea un modelo simple para probar el sistema de assets HTTP
"""
import pickle
import json
from sklearn import datasets
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import os

# Directorio de salida
OUTPUT_DIR = '/home/edmundo/IAModelHub/IAModelHub_Extensiones/model-server/models'
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 60)
print("  Creando Modelo de Ejemplo - Iris Dataset")
print("=" * 60)

# Cargar dataset Iris
print("\n1. Cargando Iris Dataset...")
iris = datasets.load_iris()
X = iris.data
y = iris.target

print(f"   - Total de muestras: {len(X)}")
print(f"   - Número de features: {X.shape[1]}")
print(f"   - Clases: {iris.target_names.tolist()}")
print(f"   - Features: {iris.feature_names}")

# Dividir en train/test
print("\n2. Dividiendo dataset (80% train, 20% test)...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"   - Train samples: {len(X_train)}")
print(f"   - Test samples: {len(X_test)}")

# Entrenar modelo
print("\n3. Entrenando Random Forest Classifier...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
print("   ✓ Modelo entrenado")

# Evaluar
print("\n4. Evaluando modelo...")
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"   - Accuracy: {accuracy:.2%}")

print("\n   Classification Report:")
print(classification_report(y_test, y_pred, target_names=iris.target_names))

# Guardar modelo
model_path = os.path.join(OUTPUT_DIR, 'iris_classifier.pkl')
print(f"\n5. Guardando modelo en: {model_path}")
with open(model_path, 'wb') as f:
    pickle.dump(model, f)
print(f"   ✓ Modelo guardado ({os.path.getsize(model_path):,} bytes)")

# Crear metadata del modelo (incluye información de variables)
metadata = {
    "model_name": "Iris Random Forest Classifier",
    "model_type": "RandomForestClassifier",
    "version": "1.0",
    "algorithm": "Random Forest",
    "library": "scikit-learn",
    "framework": "scikit-learn",
    "task": "Classification",
    "subtask": "Multi-class Classification",
    "programming_language": "Python",
    "accuracy": float(accuracy),
    "num_classes": len(iris.target_names),
    "classes": iris.target_names.tolist(),
    
    # IMPORTANTE: Documentación de features/variables requeridas
    "input_features": [
        {
            "name": "sepal length (cm)",
            "position": 0,
            "type": "float",
            "description": "Sepal length in centimeters",
            "example_value": 5.1,
            "min": float(X[:, 0].min()),
            "max": float(X[:, 0].max()),
            "mean": float(X[:, 0].mean())
        },
        {
            "name": "sepal width (cm)",
            "position": 1,
            "type": "float",
            "description": "Sepal width in centimeters",
            "example_value": 3.5,
            "min": float(X[:, 1].min()),
            "max": float(X[:, 1].max()),
            "mean": float(X[:, 1].mean())
        },
        {
            "name": "petal length (cm)",
            "position": 2,
            "type": "float",
            "description": "Petal length in centimeters",
            "example_value": 1.4,
            "min": float(X[:, 2].min()),
            "max": float(X[:, 2].max()),
            "mean": float(X[:, 2].mean())
        },
        {
            "name": "petal width (cm)",
            "position": 3,
            "type": "float",
            "description": "Petal width in centimeters",
            "example_value": 0.2,
            "min": float(X[:, 3].min()),
            "max": float(X[:, 3].max()),
            "mean": float(X[:, 3].mean())
        }
    ],
    
    # Ejemplo de input/output para testing
    "example_input": X_test[0].tolist(),
    "example_output": {
        "predicted_class": iris.target_names[y_pred[0]],
        "predicted_class_index": int(y_pred[0]),
        "probabilities": model.predict_proba([X_test[0]])[0].tolist()
    },
    
    "training_info": {
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "random_state": 42
    }
}

# Guardar metadata
metadata_path = os.path.join(OUTPUT_DIR, 'iris_classifier_metadata.json')
print(f"\n6. Guardando metadata en: {metadata_path}")
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"   ✓ Metadata guardada")

# Crear script de prueba
test_script_path = os.path.join(OUTPUT_DIR, 'test_iris_model.py')
print(f"\n7. Creando script de prueba: {test_script_path}")

test_script_content = f'''"""
Script de prueba para el modelo Iris Classifier
Muestra cómo usar el modelo con las variables documentadas
"""
import pickle
import json
import numpy as np

# Cargar modelo
with open('iris_classifier.pkl', 'rb') as f:
    model = pickle.load(f)

# Cargar metadata
with open('iris_classifier_metadata.json', 'r') as f:
    metadata = json.load(f)

print("=" * 60)
print(f"  Probando: {{metadata['model_name']}}")
print("=" * 60)

# Mostrar variables requeridas
print("\\nVariables de entrada requeridas:")
for feature in metadata['input_features']:
    print(f"  {{feature['position']}}. {{feature['name']}} ({{feature['type']}})")
    print(f"     Descripción: {{feature['description']}}")
    print(f"     Rango: [{{feature['min']:.2f}}, {{feature['max']:.2f}}]")
    print(f"     Ejemplo: {{feature['example_value']}}")
    print()

# Ejemplo 1: Usar el ejemplo documentado
print("\\nEjemplo 1: Usando input de ejemplo de metadata")
example_input = metadata['example_input']
print(f"Input: {{example_input}}")

prediction = model.predict([example_input])
probabilities = model.predict_proba([example_input])[0]

print(f"\\nPredicción: {{metadata['classes'][prediction[0]]}}")
print("Probabilidades:")
for i, class_name in enumerate(metadata['classes']):
    print(f"  {{class_name}}: {{probabilities[i]:.2%}}")

# Ejemplo 2: Crear tu propio input
print("\\n" + "=" * 60)
print("Ejemplo 2: Input personalizado")
print("=" * 60)

# Crear input basado en las variables documentadas
custom_input = [
    5.1,  # sepal length (cm)
    3.5,  # sepal width (cm)
    1.4,  # petal length (cm)
    0.2   # petal width (cm)
]

print(f"Input: {{custom_input}}")
prediction = model.predict([custom_input])
probabilities = model.predict_proba([custom_input])[0]

print(f"\\nPredicción: {{metadata['classes'][prediction[0]]}}")
print("Probabilidades:")
for i, class_name in enumerate(metadata['classes']):
    print(f"  {{class_name}}: {{probabilities[i]:.2%}}")
'''

with open(test_script_path, 'w') as f:
    f.write(test_script_content)
print(f"   ✓ Script de prueba creado")

print("\n" + "=" * 60)
print("  ✅ Modelo creado exitosamente")
print("=" * 60)
print(f"\nArchivos generados:")
print(f"  1. Modelo:    {model_path}")
print(f"  2. Metadata:  {metadata_path}")
print(f"  3. Test:      {test_script_path}")
print(f"\nPara probar el modelo:")
print(f"  cd {OUTPUT_DIR}")
print(f"  python3 test_iris_model.py")
print()
