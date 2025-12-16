"""
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
print(f"  Probando: {metadata['model_name']}")
print("=" * 60)

# Mostrar variables requeridas
print("\nVariables de entrada requeridas:")
for feature in metadata['input_features']:
    print(f"  {feature['position']}. {feature['name']} ({feature['type']})")
    print(f"     Descripción: {feature['description']}")
    print(f"     Rango: [{feature['min']:.2f}, {feature['max']:.2f}]")
    print(f"     Ejemplo: {feature['example_value']}")
    print()

# Ejemplo 1: Usar el ejemplo documentado
print("\nEjemplo 1: Usando input de ejemplo de metadata")
example_input = metadata['example_input']
print(f"Input: {example_input}")

prediction = model.predict([example_input])
probabilities = model.predict_proba([example_input])[0]

print(f"\nPredicción: {metadata['classes'][prediction[0]]}")
print("Probabilidades:")
for i, class_name in enumerate(metadata['classes']):
    print(f"  {class_name}: {probabilities[i]:.2%}")

# Ejemplo 2: Crear tu propio input
print("\n" + "=" * 60)
print("Ejemplo 2: Input personalizado")
print("=" * 60)

# Crear input basado en las variables documentadas
custom_input = [
    5.1,  # sepal length (cm)
    3.5,  # sepal width (cm)
    1.4,  # petal length (cm)
    0.2   # petal width (cm)
]

print(f"Input: {custom_input}")
prediction = model.predict([custom_input])
probabilities = model.predict_proba([custom_input])[0]

print(f"\nPredicción: {metadata['classes'][prediction[0]]}")
print("Probabilidades:")
for i, class_name in enumerate(metadata['classes']):
    print(f"  {class_name}: {probabilities[i]:.2%}")
